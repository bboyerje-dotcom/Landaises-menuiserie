// Étape 2 — bout en bout dans Chromium : relevé d'un ouvrage, écran → IndexedDB.
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { demarrer } from '../server.mjs';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }

let srv, url, browser, ctx, page;
before(async () => { srv = await demarrer(0); url = `http://127.0.0.1:${srv.address().port}/`; browser = await chromium.launch(); });
after(async () => { await browser?.close(); srv?.close(); });
beforeEach(async () => {
  await ctx?.close();
  ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  page = await ctx.newPage();
  page.on('pageerror', (e) => { throw e; });
});

async function creerDossier(p) {
  await p.goto(url + '#/nouveau');
  for (const [k, v] of Object.entries({ clientNom: 'Dupont', telephone: '0612345678', adresse: '1 rue A', codePostal: '40000', commune: 'Mont-de-Marsan', responsable: 'B. Test' })) await p.fill('#' + k, v);
  await p.check('input[name=typeChantier][value=renovation]');
  await p.check('input[name=natureBatiment][value=maison]');
  await p.click('#enregistrer');
  await p.waitForSelector('[data-test=cree]');
  return p.url().match(/dossier\/([^?]+)/)[1];
}

async function ouvrirNouvelOuvrage(p) {
  await p.click('[data-test=ajouter-ouvrage]');
  await p.waitForSelector('#fo');
}

async function remplirComplet(p, o = {}) {
  const r = (n, v) => p.check(`input[name="${n}"][value="${v}"]`);
  await r('typologie', o.typologie || 'fenetre');
  await p.fill('#localisation', 'Séjour');
  await r('typePose', 'renovation');
  await p.check('#poseConfirmee');
  await r('etatDormant', 'bon');
  await r('pointDeVueMesure', 'interieur');
  await r('referenceMesure', 'dormant_existant');
  const c = { L1: '1200', L2: '1198', L3: '1201', H1: '1350', H2: '1352', H3: '1349', ...o.cotes };
  for (const [k, v] of Object.entries(c)) await p.fill('#' + k, v);
  await r('typeOuverture', 'francaise');
  await r('nbVantaux', '2');
  await r('sens', 'droite');
  await r('materiau', 'alu');
  await p.fill('#colorisInt', 'Blanc');
  await p.fill('#colorisExt', 'RAL 7016');
}

const ouvragesEnBase = (p) => p.evaluate(() => new Promise((ok) => {
  const r = indexedDB.open('pilotage-terrain');
  r.onsuccess = () => { const g = r.result.transaction('ouvrages').objectStore('ouvrages').getAll(); g.onsuccess = () => { ok(g.result); r.result.close(); }; };
}));

test('migration : un dossier créé avec l’étape 1 (base v1) est conservé et accepte des ouvrages', async () => {
  await page.goto(url + 'css/app.css'); // même origine, sans lancer l'application
  await page.evaluate(() => new Promise((ok, ko) => {
    const r = indexedDB.open('pilotage-terrain', 1);
    r.onupgradeneeded = () => { const s = r.result.createObjectStore('dossiers', { keyPath: 'id' }); s.createIndex('reference', 'reference', { unique: true }); s.createIndex('creeLe', 'creeLe'); };
    r.onsuccess = () => {
      const tx = r.result.transaction('dossiers', 'readwrite');
      tx.objectStore('dossiers').add({ id: 'ancien', reference: 'LDM-261120-001', clientNom: 'Client étape 1', telephone: '0600000000', adresse: 'x', codePostal: '40000', commune: 'Dax', responsable: 'B', dateRdv: '2026-11-20', typeChantier: 'renovation', natureBatiment: 'maison', statut: 'releve_en_cours', creeLe: '2026-11-20T10:00:00.000Z' });
      tx.oncomplete = () => { r.result.close(); ok(); };
      tx.onerror = () => ko(tx.error);
    };
  }));
  await page.goto(url);
  await page.waitForSelector('[data-test=ligne-dossier]');
  assert.match(await page.textContent('[data-test=ligne-dossier]'), /Client étape 1/);
  await page.goto(url + '#/dossier/ancien');
  await ouvrirNouvelOuvrage(page);
  await remplirComplet(page);
  await page.click('#enregistrer-ouvrage');
  await page.waitForSelector('[data-test=ligne-ouvrage]');
  assert.equal((await ouvragesEnBase(page)).length, 1);
});

test('ouvrage complet → COMPLET, repère F1 proposé, cotes retenues affichées', async () => {
  await creerDossier(page);
  await ouvrirNouvelOuvrage(page);
  await remplirComplet(page);
  assert.equal(await page.inputValue('#repere'), 'F1');
  assert.match(await page.textContent('[data-test=retenues]'), /L 1198 mm.*H 1349 mm/);
  assert.match(await page.textContent('[data-test=apercu]'), /COMPLET/);
  await page.click('#enregistrer-ouvrage');
  await page.waitForSelector('[data-test=ligne-ouvrage]');
  assert.equal(await page.textContent('[data-test=statut-ouvrage]'), 'COMPLET');
  assert.match(await page.textContent('[data-test=synthese-ouvrages]'), /1 COMPLET · 0 À VÉRIFIER/);
});

test('ouvrage incomplet → enregistré en À VÉRIFIER avec la liste des points', async () => {
  await creerDossier(page);
  await ouvrirNouvelOuvrage(page);
  await page.check('input[name=typologie][value=porte_fenetre]');
  assert.equal(await page.inputValue('#repere'), 'PF1');
  await page.click('#enregistrer-ouvrage');
  await page.waitForSelector('[data-test=ligne-ouvrage]');
  assert.equal(await page.textContent('[data-test=statut-ouvrage]'), 'À VÉRIFIER');
  assert.match(await page.textContent('[data-test=ligne-ouvrage]'), /Type de pose non renseigné/);
});

test('cote saisie avec virgule ou hors plage → enregistrement refusé, message sur le champ', async () => {
  await creerDossier(page);
  await ouvrirNouvelOuvrage(page);
  await remplirComplet(page, { cotes: { L1: '1,20', H2: '135' } });
  await page.click('#enregistrer-ouvrage');
  await page.waitForSelector('[data-test=erreurs-ouvrage]');
  assert.match(await page.textContent('#err-L1'), /millimètres, sans virgule/);
  assert.match(await page.textContent('#err-H2'), /hors plage/);
  assert.equal(await page.getAttribute('#L1', 'aria-invalid'), 'true');
  assert.equal((await ouvragesEnBase(page)).length, 0);
});

test('double-clic sur Enregistrer → un seul ouvrage', async () => {
  await creerDossier(page);
  await ouvrirNouvelOuvrage(page);
  await remplirComplet(page);
  await page.evaluate(() => { const b = document.getElementById('enregistrer-ouvrage'); b.click(); b.click(); b.click(); });
  await page.waitForSelector('[data-test=ligne-ouvrage]');
  assert.equal(await page.locator('[data-test=ligne-ouvrage]').count(), 1);
  assert.equal((await ouvragesEnBase(page)).length, 1);
});

test('repère déjà utilisé dans le dossier → refusé', async () => {
  await creerDossier(page);
  await ouvrirNouvelOuvrage(page);
  await remplirComplet(page);
  await page.click('#enregistrer-ouvrage');
  await page.waitForSelector('[data-test=ligne-ouvrage]');
  await ouvrirNouvelOuvrage(page);
  await page.check('input[name=typologie][value=fenetre]');
  assert.equal(await page.inputValue('#repere'), 'F2', 'repère suivant proposé');
  await page.fill('#repere', 'f1');
  await page.click('#enregistrer-ouvrage');
  await page.waitForSelector('[data-test=erreurs-ouvrage]');
  assert.match(await page.textContent('#err-repere'), /F1 existe déjà/);
});

test('changer le type de pose décoche la confirmation client', async () => {
  await creerDossier(page);
  await ouvrirNouvelOuvrage(page);
  await page.check('input[name=typePose][value=renovation]');
  await page.check('#poseConfirmee');
  await page.check('input[name=typePose][value=depose_totale]');
  assert.equal(await page.isChecked('#poseConfirmee'), false);
  assert.match(await page.textContent('[data-test=apercu]'), /non confirmé par le client/);
});

test('champ masqué non applicable : pas de valeur périmée enregistrée', async () => {
  await creerDossier(page);
  await ouvrirNouvelOuvrage(page);
  await remplirComplet(page);
  await page.check('input[name=etatDormant][value=mauvais]');
  await page.check('input[name=typePose][value=depose_totale]'); // état dormant masqué
  await page.click('#enregistrer-ouvrage');
  await page.waitForSelector('[data-test=ligne-ouvrage]');
  const [o] = await ouvragesEnBase(page);
  assert.equal(o.etatDormant, '');
  assert.equal(o.poseConfirmee, false);
});

test('brouillon de l’ouvrage restauré après rechargement', async () => {
  await creerDossier(page);
  await ouvrirNouvelOuvrage(page);
  await page.check('input[name=typologie][value=fenetre]');
  await page.fill('#L1', '1234');
  await page.check('input[name=sens][value=gauche]');
  await page.reload();
  await page.waitForSelector('[data-test=brouillon-restaure]');
  assert.equal(await page.inputValue('#L1'), '1234');
  assert.equal(await page.inputValue('#repere'), 'F1');
  assert.equal(await page.isChecked('input[name=sens][value=gauche]'), true);
});

test('modification d’un ouvrage → version 2, historique, pas de doublon', async () => {
  await creerDossier(page);
  await ouvrirNouvelOuvrage(page);
  await remplirComplet(page);
  await page.click('#enregistrer-ouvrage');
  await page.waitForSelector('[data-test=ligne-ouvrage]');
  await page.click('[data-test=ligne-ouvrage]');
  await page.waitForSelector('#fo');
  assert.equal(await page.inputValue('#L2'), '1198');
  await page.fill('#L2', '1196');
  await page.click('#enregistrer-ouvrage');
  await page.waitForSelector('[data-test=ligne-ouvrage]');
  const tous = await ouvragesEnBase(page);
  assert.equal(tous.length, 1);
  assert.equal(tous[0].version, 2);
  assert.equal(tous[0].largeurRetenue, 1196);
  assert.deepEqual(tous[0].historique.map((h) => h.action), ['création', 'modification']);
  // Enregistrer sans rien changer ne crée pas de version 3.
  await page.click('[data-test=ligne-ouvrage]');
  await page.waitForSelector('#fo');
  await page.click('#enregistrer-ouvrage');
  await page.waitForSelector('[data-test=ligne-ouvrage]');
  assert.equal((await ouvragesEnBase(page))[0].version, 2);
});

test('échec d’enregistrement simulé → message, saisie conservée, réessai réussi', async () => {
  await creerDossier(page);
  await ouvrirNouvelOuvrage(page);
  await remplirComplet(page);
  await page.evaluate(() => {
    const orig = IDBObjectStore.prototype.put;
    let n = 0;
    IDBObjectStore.prototype.put = function (...a) { if (n++ === 0) throw new DOMException('Quota simulé', 'QuotaExceededError'); return orig.apply(this, a); };
  });
  await page.click('#enregistrer-ouvrage');
  await page.waitForSelector('[data-test=echec-ouvrage]');
  assert.equal(await page.inputValue('#L1'), '1200');
  await page.click('#enregistrer-ouvrage');
  await page.waitForSelector('[data-test=ligne-ouvrage]');
  assert.equal((await ouvragesEnBase(page)).length, 1);
});

test('formulaire ouvrage sur smartphone : pas de défilement horizontal', async () => {
  await creerDossier(page);
  await ouvrirNouvelOuvrage(page);
  await remplirComplet(page);
  await page.check('#hesitationPose');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
});
