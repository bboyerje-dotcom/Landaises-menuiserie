// Étape 5 — aide à la prise de cotes : catalogue illustré, cotes dessinées sur la photo.
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { demarrer } from '../server.mjs';
import { imageJpeg, ajouterPhoto, variante, lireBase } from './aide-e2e.js';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }

let srv, url, browser, ctx, page, IMG;
before(async () => { srv = await demarrer(0); url = `http://127.0.0.1:${srv.address().port}/`; browser = await chromium.launch(); IMG = await imageJpeg(browser, 1600, 1200, 'Baie'); });
after(async () => { await browser?.close(); srv?.close(); });
beforeEach(async () => {
  await ctx?.close();
  ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  page = await ctx.newPage();
  page.setDefaultTimeout(10000);
  page.on('pageerror', (e) => { throw e; });
});

async function dossier(p) {
  await p.goto(url + '#/nouveau');
  for (const [k, v] of Object.entries({ clientNom: 'Dupont', telephone: '0612345678', adresse: '1 rue A', codePostal: '40000', commune: 'Dax', responsable: 'B. Test' })) await p.fill('#' + k, v);
  await p.check('input[name=typeChantier][value=renovation]');
  await p.check('input[name=natureBatiment][value=maison]');
  await p.click('#enregistrer');
  await p.waitForSelector('[data-test=cree]');
}
async function choisir(p, id) {
  await p.click('[data-test=ajouter-ouvrage]');
  await p.click(`[data-test=produit-${id}]`);
  await p.waitForSelector('#fc, #fo');
}
// Attente active d'une condition sur la base (IndexedDB est asynchrone).
async function attendreBase(p, store, cond) {
  for (let i = 0; i < 40; i++) {
    const t = await lireBase(p, store);
    if (cond(t)) return t;
    await p.waitForTimeout(150);
  }
  throw new Error('condition non atteinte en base');
}
const r = (p, n, v) => p.check(`input[name="${n}"][value="${v}"]`);
const traitX = (p, id) => p.$eval(`[data-test=photo-cotes] [data-cote-trait="${id}"] line`, (l) => [Number(l.getAttribute('x1')), Number(l.getAttribute('x2'))]);

test('choix du produit : 21 produits illustrés, fenêtre → formulaire détaillé, volet → relevé guidé', async () => {
  await dossier(page);
  await page.click('[data-test=ajouter-ouvrage]');
  await page.waitForSelector('[data-test=produit-carport]');
  assert.equal(await page.locator('.carte-produit').count(), 21);
  assert.equal(await page.locator('.carte-produit svg').count(), 21);
  await page.click('[data-test=produit-fenetre]');
  await page.waitForSelector('#fo');
  assert.equal(await page.isChecked('input[name=typologie][value=fenetre]'), true);
  assert.equal(await page.inputValue('#repere'), 'F1');
  await page.goBack(); await page.goBack();
  await choisir(page, 'vr_traditionnel');
  await page.waitForSelector('#fc');
  assert.equal(await page.inputValue('#repere'), 'VRT1');
  assert.equal(await page.inputValue('#quantite'), '1');
  assert.ok(await page.isVisible('[data-test=photo-cotes-vide]'), 'invite à prendre la photo, avec le schéma');
});

test('photo affichée tout de suite, puis chaque cote saisie apparaît dessus dans sa couleur', async () => {
  await dossier(page);
  await choisir(page, 'baie_coulissante');
  await r(page, 'pointDeVueMesure', 'exterieur');
  await ajouterPhoto(page, 'exterieur', IMG, 'baie.jpg');
  await page.waitForSelector('[data-test=photo-cotes-img]');
  assert.ok(await page.$eval('[data-test=photo-cotes-img]', (i) => i.complete && i.naturalWidth === 1600));
  assert.equal(await page.locator('[data-test=photo-cotes] [data-cote]').count(), 0, 'aucune cote avant saisie');
  await page.fill('#cote_L1', '2400');
  await page.fill('#cote_H1', '2150');
  await page.fill('#cote_RH', '40');
  const txt = await page.textContent('[data-test=photo-cotes] svg');
  assert.match(txt, /L1 2400/);
  assert.match(txt, /H1 2150/);
  assert.match(txt, /RH 40/);
  assert.match(txt, /VUE EXTÉRIEURE/);
  const couleur = (id) => page.$eval(`[data-test=photo-cotes] [data-cote-trait="${id}"] line`, (l) => l.getAttribute('stroke'));
  assert.equal(await couleur('L1'), '#1565c0', 'largeur en bleu');
  assert.equal(await couleur('H1'), '#c62828', 'hauteur en rouge');
  assert.equal(await couleur('RH'), '#2e7d32', 'retour d’habillage en vert');
});

test('photo extérieure + mesures depuis l’intérieur → gauche/droite inversées et signalées', async () => {
  await dossier(page);
  await choisir(page, 'baie_coulissante');
  await ajouterPhoto(page, 'exterieur', IMG, 'baie.jpg');
  await page.fill('#cote_H1', '2150');
  await r(page, 'pointDeVueMesure', 'exterieur');
  const [xMeme] = await traitX(page, 'H1');
  assert.ok(xMeme < 800, `H1 « gauche » à gauche quand photo et mesures sont du même côté (${xMeme})`);
  await r(page, 'pointDeVueMesure', 'interieur');
  await page.waitForSelector('[data-test=pc-inversion]');
  const [xInv] = await traitX(page, 'H1');
  assert.ok(xInv > 800, `H1 « gauche » dessinée à droite sur la photo extérieure (${xInv})`);
});

test('déplacement d’une cote au doigt : position enregistrée et conservée au rechargement', async () => {
  await dossier(page);
  await choisir(page, 'porte_entree');
  await r(page, 'pointDeVueMesure', 'exterieur');
  await ajouterPhoto(page, 'exterieur', IMG, 'porte.jpg');
  await page.fill('#cote_L1', '950');
  const rond = page.locator('[data-test=photo-cotes] [data-cote="L1"] .poignee[data-bout="1"]');
  const box = await rond.boundingBox();
  const cadre = await page.locator('[data-test=photo-cotes] svg').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(cadre.x + cadre.width * 0.1, cadre.y + cadre.height * 0.3, { steps: 5 });
  await page.mouse.up();
  const [ph] = await attendreBase(page, 'photos', (t) => !!t[0]?.annotations?.L1);
  assert.ok(Math.abs(ph.annotations.L1[0] - 0.1) < 0.03 && Math.abs(ph.annotations.L1[1] - 0.3) < 0.03, JSON.stringify(ph.annotations.L1));
  await page.reload();
  await page.waitForSelector('[data-test=photo-cotes] [data-cote-trait="L1"]');
  const [x1] = await traitX(page, 'L1');
  assert.ok(Math.abs(x1 - 160) < 50, `position conservée (${x1})`);
  await page.click('[data-test=pc-reinit]');
  await page.waitForFunction(() => Number(document.querySelector('[data-test=photo-cotes] [data-cote-trait="L1"] line').getAttribute('x1')) > 400);
});

test('volet roulant traditionnel complet → COMPLET ; option alimentation masquée si sangle', async () => {
  await dossier(page);
  await choisir(page, 'vr_traditionnel');
  await page.fill('#localisation', 'Salon');
  await r(page, 'pointDeVueMesure', 'interieur');
  await r(page, 'typePose', 'caisson_existant');
  await page.check('#poseConfirmee');
  for (const [k, v] of Object.entries({ L1: '1200', L2: '1203', H1: '1500', H2: '1502', LC: '1180', HC: '250', PC: '260' })) await page.fill('#cote_' + k, v);
  await r(page, 'opt_manoeuvre', 'sangle');
  assert.equal(await page.isVisible('[data-option="alimentation"]'), false);
  await r(page, 'opt_manoeuvre', 'radio');
  assert.equal(await page.isVisible('[data-option="alimentation"]'), true);
  await r(page, 'opt_alimentation', 'oui');
  await r(page, 'opt_coteManoeuvre', 'gauche');
  await r(page, 'opt_coteManoeuvre_vue', 'interieur');
  await r(page, 'opt_lames', 'alu');
  await ajouterPhoto(page, 'interieur', variante(IMG, 'i'), 'i.jpg');
  await ajouterPhoto(page, 'exterieur', variante(IMG, 'e'), 'e.jpg');
  assert.match(await page.textContent('[data-test=apercu]'), /COMPLET/);
  assert.match(await page.textContent('[data-test=retenues]'), /L 1200 mm.*H 1500 mm/);
  await page.click('#enregistrer-ouvrage');
  await page.waitForSelector('[data-test=ligne-ouvrage]');
  assert.match(await page.textContent('[data-test=ligne-ouvrage]'), /VRT1 · Volet roulant traditionnel/);
  assert.equal(await page.textContent('[data-test=statut-ouvrage]'), 'COMPLET');
  const [o] = await lireBase(page, 'ouvrages');
  assert.equal(o.kind, 'catalogue');
  assert.equal(o.cotes.LC, 1180);
  assert.equal(o.options.manoeuvre, 'radio');
  // réouverture : le relevé guidé est rechargé avec ses valeurs
  await page.click('[data-test=ligne-ouvrage]');
  await page.waitForSelector('#fc');
  assert.equal(await page.inputValue('#cote_HC'), '250');
});

test('pente : calcul en degrés depuis un dénivelé, angle illisible ou > 60° refusé', async () => {
  await dossier(page);
  await choisir(page, 'store_banne_coffre');
  await page.click('[data-champ="cote_PE"] summary');
  await page.fill('[data-calc="d"][data-pour="PE"]', '100');
  await page.fill('[data-calc="l"][data-pour="PE"]', '1000');
  await page.click('[data-calculer="PE"]');
  assert.equal(await page.inputValue('#cote_PE'), '5,7');
  await page.fill('#cote_PE', '75');
  await page.fill('#cote_LP', '4,5');
  await page.click('#enregistrer-ouvrage');
  await page.waitForSelector('[data-test=erreurs-ouvrage]');
  assert.match(await page.textContent('#err-cote_PE'), /60°/);
  assert.match(await page.textContent('#err-cote_LP'), /millimètres/);
  assert.equal((await lireBase(page, 'ouvrages')).length, 0);
});

test('double-clic sur Enregistrer (relevé guidé) → un seul ouvrage', async () => {
  await dossier(page);
  await choisir(page, 'carport');
  await page.evaluate(() => { const b = document.getElementById('enregistrer-ouvrage'); b.click(); b.click(); b.click(); });
  await page.waitForSelector('[data-test=ligne-ouvrage]');
  assert.equal((await lireBase(page, 'ouvrages')).length, 1);
});

test('fenêtre (formulaire détaillé) : cotes aussi dessinées sur la photo', async () => {
  await dossier(page);
  await choisir(page, 'fenetre');
  await page.waitForSelector('#fo');
  await ajouterPhoto(page, 'interieur', IMG, 'f.jpg');
  await page.fill('#L1', '1200');
  await page.fill('#H2', '1350');
  await page.waitForSelector('[data-test=photo-cotes] [data-cote-trait="H2"]');
  assert.match(await page.textContent('[data-test=photo-cotes] svg'), /L1 1200[\s\S]*H2 1350/);
});

test('relevé PDF : fiche du produit avec schéma coté, tableau de métrage et photo annotée', async () => {
  await dossier(page);
  await choisir(page, 'portail_battant');
  await r(page, 'pointDeVueMesure', 'exterieur');
  await page.fill('#cote_L1', '3500');
  await page.fill('#cote_PS', '4,5');
  await ajouterPhoto(page, 'exterieur', IMG, 'p.jpg');
  await page.click('#enregistrer-ouvrage');
  await page.waitForSelector('[data-test=ligne-ouvrage]');
  await page.click('[data-test=ouvrir-releve]');
  await page.waitForSelector('[data-test=fiche-ouvrage]');
  const fiche = await page.textContent('[data-test=fiche-ouvrage]');
  assert.match(fiche, /PB1 · Portail battant/);
  assert.match(fiche, /Tableau de métrage/);
  assert.match(fiche, /Passage entre piliers – haut\s*3500/);
  assert.match(fiche, /Hauteur pilier gauche\s*NON MESURÉ/);
  assert.equal(await page.locator('[data-test=fiche-ouvrage] .illus').count(), 1);
  assert.match(await page.textContent('[data-test=fiche-ouvrage] [data-test=calque-cotes]'), /L1 3500[\s\S]*° 4.5°/);
});

test('guide des relevés : 21 schémas et la légende des couleurs', async () => {
  await page.goto(url + '#/guide');
  await page.waitForSelector('[data-test=guide-carport]');
  assert.equal(await page.locator('.guide-produit svg').count(), 21);
  assert.match(await page.textContent('[data-test=legende]'), /Largeur.*Hauteur.*Retour d’habillage.*Tapée/);
});

test('relevé guidé avec photo sur smartphone : pas de défilement horizontal', async () => {
  await dossier(page);
  await choisir(page, 'garage_sectionnelle');
  await ajouterPhoto(page, 'exterieur', IMG, 'g.jpg');
  await page.fill('#cote_L1', '2400');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
});
