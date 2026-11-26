// Étape 3 — photos : bout en bout dans Chromium, écran → IndexedDB.
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { demarrer } from '../server.mjs';
import { imageJpeg, avecExif, ajouterPhoto, ajouterPhotosObligatoires, lireBase, variante } from './aide-e2e.js';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }

let srv, url, browser, ctx, page, IMG, GRANDE;
before(async () => {
  srv = await demarrer(0);
  url = `http://127.0.0.1:${srv.address().port}/`;
  browser = await chromium.launch();
  IMG = await imageJpeg(browser);
  GRANDE = await imageJpeg(browser, 3000, 2000, 'GRANDE');
});
after(async () => { await browser?.close(); srv?.close(); });
beforeEach(async () => {
  await ctx?.close();
  ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  page = await ctx.newPage();
  page.setDefaultTimeout(10000);
  page.on('pageerror', (e) => { throw e; });
});

async function dossierEtOuvrage(p, { complet = true } = {}) {
  await p.goto(url + '#/nouveau');
  for (const [k, v] of Object.entries({ clientNom: 'Dupont', telephone: '0612345678', adresse: '1 rue A', codePostal: '40000', commune: 'Mont-de-Marsan', responsable: 'B. Test' })) await p.fill('#' + k, v);
  await p.check('input[name=typeChantier][value=renovation]');
  await p.check('input[name=natureBatiment][value=maison]');
  await p.click('#enregistrer');
  await p.waitForSelector('[data-test=cree]');
  await p.click('[data-test=ajouter-ouvrage]');
  await p.click('[data-test=produit-fenetre]');
  await p.waitForSelector('[data-test=nb-exterieur]');
  const r = (n, v) => p.check(`input[name="${n}"][value="${v}"]`);
  await r('typologie', 'fenetre');
  if (!complet) return;
  await p.fill('#localisation', 'Séjour');
  await r('typePose', 'renovation'); await p.check('#poseConfirmee'); await r('etatDormant', 'bon');
  await r('pointDeVueMesure', 'interieur'); await r('referenceMesure', 'dormant_existant');
  for (const [k, v] of Object.entries({ L1: '1200', L2: '1198', L3: '1201', H1: '1350', H2: '1352', H3: '1349' })) await p.fill('#' + k, v);
  await r('typeOuverture', 'francaise'); await r('nbVantaux', '2'); await r('sens', 'droite'); await r('materiau', 'alu');
  await p.fill('#colorisInt', 'Blanc'); await p.fill('#colorisExt', 'RAL 7016');
}

test('photos obligatoires : sans elles À VÉRIFIER, avec elles COMPLET et compteur dans le dossier', async () => {
  await dossierEtOuvrage(page);
  const apercu = await page.textContent('[data-test=apercu]');
  assert.match(apercu, /Photo « Vue extérieure » manquante/);
  assert.match(apercu, /Photo « Vue intérieure » manquante/);
  await ajouterPhotosObligatoires(page, IMG);
  assert.match(await page.textContent('[data-test=apercu]'), /COMPLET/);
  assert.equal(await page.locator('[data-test=mini]').count(), 2);
  await page.click('#enregistrer-ouvrage');
  await page.waitForSelector('[data-test=ligne-ouvrage]');
  assert.equal(await page.textContent('[data-test=statut-ouvrage]'), 'COMPLET');
  assert.match(await page.textContent('[data-test=nb-photos]'), /2 photos/);
});

test('compression : 3000×2000 → 1600×1067 JPEG plus léger, métadonnées (EXIF/GPS) supprimées', async () => {
  await dossierEtOuvrage(page, { complet: false });
  const source = avecExif(GRANDE);
  assert.ok(source.includes('GPSPOSITIONTEST'), 'la source contient bien le marqueur');
  await ajouterPhoto(page, 'exterieur', source, 'grande.jpg');
  assert.equal(await page.locator('[data-test=mini]').count(), 1, 'photo acceptée');
  const [ph] = await lireBase(page, 'photos');
  assert.equal(ph.largeur, 1600);
  assert.equal(ph.hauteur, 1067);
  assert.equal(ph.type, 'image/jpeg');
  assert.ok(ph.taille < source.length, `${ph.taille} < ${source.length}`);
  assert.ok(ph.miniature.octets < ph.donnees.octets);
  assert.ok(!ph.donnees.texte.includes('GPSPOSITIONTEST'), 'marqueur GPS absent de l’image stockée');
  assert.ok(!ph.donnees.texte.includes('Exif'), 'aucun bloc EXIF dans l’image stockée');
});

test('photo ajoutée sur un ouvrage déjà enregistré → statut mis à jour sans nouvelle version, tracé', async () => {
  await dossierEtOuvrage(page);
  await page.click('#enregistrer-ouvrage');
  await page.waitForSelector('[data-test=ligne-ouvrage]');
  assert.equal(await page.textContent('[data-test=statut-ouvrage]'), 'À VÉRIFIER');
  await page.click('[data-test=ligne-ouvrage]');
  await page.waitForSelector('[data-test=nb-exterieur]');
  await ajouterPhotosObligatoires(page, IMG);
  await page.goBack(); // retour au dossier SANS réenregistrer le formulaire
  await page.waitForSelector('[data-test=ligne-ouvrage]');
  assert.equal(await page.textContent('[data-test=statut-ouvrage]'), 'COMPLET');
  const [o] = await lireBase(page, 'ouvrages');
  assert.equal(o.version, 1);
  assert.ok(o.historique.some((h) => /photos modifiées \(2 au total\)/.test(h.action)));
  await page.reload();
  await page.click('[data-test=ligne-ouvrage]');
  await page.waitForSelector('[data-test=mini]');
  assert.equal(await page.locator('[data-test=mini]').count(), 2, 'photos toujours là après rechargement');
});

test('même photo choisie deux fois (même sous un autre nom ou une autre catégorie) → refusée', async () => {
  await dossierEtOuvrage(page, { complet: false });
  await ajouterPhoto(page, 'support', IMG, 'IMG_0001.jpg', { galerie: true });
  await ajouterPhoto(page, 'support', IMG, 'IMG_0001.jpg', { galerie: true });
  assert.match(await page.textContent('[data-test=photos-msg]'), /déjà rattachée/);
  await ajouterPhoto(page, 'technique', IMG, 'copie.jpg', { galerie: true });
  assert.match(await page.textContent('[data-test=photos-msg]'), /déjà rattachée/);
  assert.match(await page.textContent('[data-test=nb-support]'), /^1 photo$/);
});

test('sélection multiple dans la galerie → toutes ajoutées', async () => {
  await dossierEtOuvrage(page, { complet: false });
  const f = (n) => ({ name: `g${n}.jpg`, mimeType: 'image/jpeg', buffer: variante(IMG, n) });
  await page.setInputFiles('[data-test=galerie-technique]', [f(1), f(2), f(3)]);
  await page.waitForFunction(() => /3 photos/.test(document.querySelector('[data-test=nb-technique]').textContent));
  assert.match(await page.textContent('[data-test=photos-msg]'), /3 photos enregistrées/);
});

test('suppression : annulation conserve, confirmation supprime et remet le statut À VÉRIFIER', async () => {
  await dossierEtOuvrage(page);
  await ajouterPhotosObligatoires(page, IMG);
  await page.click('#enregistrer-ouvrage');
  await page.waitForSelector('[data-test=ligne-ouvrage]');
  await page.click('[data-test=ligne-ouvrage]');
  await page.waitForSelector('[data-test=mini]');
  page.once('dialog', (d) => d.dismiss());
  await page.locator('[data-test=mini]').first().click();
  await page.click('[data-test=supprimer-photo]');
  await page.click('#vis-fermer');
  assert.equal(await page.locator('[data-test=mini]').count(), 2);
  page.once('dialog', (d) => d.accept());
  await page.locator('[data-test=mini]').first().click();
  await page.click('[data-test=supprimer-photo]');
  await page.waitForFunction(() => document.querySelectorAll('[data-test=mini]').length === 1);
  assert.equal((await lireBase(page, 'photos')).length, 1);
  const [o] = await lireBase(page, 'ouvrages');
  assert.equal(o.statut, 'a_verifier');
});

test('fichier non image ou image illisible → refusé, rien stocké', async () => {
  await dossierEtOuvrage(page, { complet: false });
  await page.setInputFiles('[data-test=galerie-support]', { name: 'devis.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4') });
  await page.waitForSelector('[data-test=photos-msg]');
  assert.match(await page.textContent('[data-test=photos-msg]'), /pas une image/);
  await page.setInputFiles('[data-test=galerie-support]', { name: 'casse.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('pas une vraie image') });
  await page.waitForFunction(() => /non pris en charge/.test(document.querySelector('[data-test=photos-msg]')?.textContent || ''));
  assert.equal((await lireBase(page, 'photos')).length, 0);
});

test('stockage plein simulé → message clair, rien de partiel, réessai réussi', async () => {
  await dossierEtOuvrage(page, { complet: false });
  await page.evaluate(() => {
    const orig = IDBObjectStore.prototype.add;
    let n = 0;
    IDBObjectStore.prototype.add = function (...a) { if (this.name === 'photos' && n++ === 0) throw new DOMException('plein', 'QuotaExceededError'); return orig.apply(this, a); };
  });
  await ajouterPhoto(page, 'exterieur', IMG, 'a.jpg');
  assert.match(await page.textContent('[data-test=photos-msg]'), /espace de stockage plein/);
  assert.equal((await lireBase(page, 'photos')).length, 0);
  await ajouterPhoto(page, 'exterieur', IMG, 'a.jpg');
  assert.equal((await lireBase(page, 'photos')).length, 1);
});

test('nouvel ouvrage non enregistré : photo conservée au rechargement, supprimée si on annule le brouillon', async () => {
  await dossierEtOuvrage(page, { complet: false });
  await ajouterPhoto(page, 'exterieur', IMG, 'a.jpg');
  await page.reload();
  await page.waitForSelector('[data-test=brouillon-restaure]');
  await page.waitForSelector('[data-test=mini]');
  assert.match(await page.textContent('[data-test=nb-exterieur]'), /1 photo/);
  await page.click('#jeter-o');
  await page.waitForFunction(() => !document.querySelector('[data-test=brouillon-restaure]'));
  assert.equal((await lireBase(page, 'photos')).length, 0);
});

test('légende enregistrée et affichée', async () => {
  await dossierEtOuvrage(page, { complet: false });
  await ajouterPhoto(page, 'technique', IMG, 'a.jpg');
  await page.click('[data-test=mini]');
  await page.fill('#vis-legende', 'Appui fissuré côté gauche');
  await page.click('#vis-enregistrer');
  await page.waitForFunction(() => /Appui fissuré/.test(document.querySelector('[data-test=mini]').textContent));
  assert.equal((await lireBase(page, 'photos'))[0].legende, 'Appui fissuré côté gauche');
});

test('sauvegarde JSON : contient les photos en base64', async () => {
  await dossierEtOuvrage(page);
  await ajouterPhotosObligatoires(page, IMG);
  await page.click('#enregistrer-ouvrage');
  await page.waitForSelector('[data-test=ligne-ouvrage]');
  await page.goto(url + '#/');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#export')]);
  const j = JSON.parse(await readFile(await dl.path(), 'utf8'));
  assert.equal(j.version, 3);
  assert.equal(j.dossiers.length, 1);
  assert.equal(j.ouvrages.length, 1);
  assert.equal(j.photos.length, 2);
  assert.match(j.photos[0].donnees, /^\/9j\//, 'JPEG en base64');
});

test('écran avec photos sur smartphone : pas de défilement horizontal', async () => {
  await dossierEtOuvrage(page, { complet: false });
  await ajouterPhotosObligatoires(page, IMG);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
});
