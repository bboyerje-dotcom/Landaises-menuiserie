// Tests de bout en bout dans un vrai navigateur (Chromium), écran → IndexedDB.
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { demarrer } from '../server.mjs';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }

let srv, url, browser, ctx, page;

before(async () => {
  srv = await demarrer(0);
  url = `http://127.0.0.1:${srv.address().port}/`;
  browser = await chromium.launch();
});
after(async () => { await browser?.close(); srv?.close(); });
beforeEach(async () => {
  await ctx?.close();
  ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }); // smartphone
  page = await ctx.newPage();
  page.setDefaultTimeout(10000);
  page.on('pageerror', (e) => { throw e; });
  await page.goto(url);
});

async function remplir(p, o = {}) {
  const v = { clientNom: 'Dupont Jean', telephone: '06 12 34 56 78', adresse: '12 rue des Pins',
    codePostal: '40000', commune: 'Mont-de-Marsan', responsable: 'B. Test', ...o };
  await p.goto(url + '#/nouveau');
  for (const [k, val] of Object.entries(v)) await p.fill(`#${k}`, val);
  await p.check('input[name=typeChantier][value=renovation]');
  await p.check('input[name=natureBatiment][value=maison]');
}
const nbDossiers = async (p) => { await p.goto(url + '#/'); await p.waitForSelector('h1'); return p.locator('[data-test=ligne-dossier]').count(); };

test('formulaire vide : erreurs affichées, rien enregistré', async () => {
  await page.goto(url + '#/nouveau');
  await page.fill('#dateRdv', '');
  await page.click('#enregistrer');
  const txt = await page.textContent('[data-test=erreurs]');
  assert.match(txt, /9 champ\(s\) à compléter/);
  assert.equal(await page.getAttribute('#clientNom', 'aria-invalid'), 'true');
  assert.equal(await nbDossiers(page), 0);
});

test('création complète → référence, détail, liste, persistance après rechargement', async () => {
  await remplir(page);
  await page.click('#enregistrer');
  await page.waitForSelector('[data-test=cree]');
  const ref = await page.textContent('[data-test=reference]');
  assert.match(ref, /^LDM-\d{6}-001$/);
  assert.equal(await nbDossiers(page), 1);
  await page.reload();
  assert.equal(await nbDossiers(page), 1);
  assert.match(await page.textContent('[data-test=ligne-dossier]'), /Dupont Jean/);
});

test('double-clic / envoi répété : un seul dossier créé', async () => {
  await remplir(page);
  await page.evaluate(() => { const b = document.getElementById('enregistrer'); b.click(); b.click(); b.click(); });
  await page.waitForSelector('[data-test=cree]');
  assert.equal(await nbDossiers(page), 1);
});

test('doublon (même téléphone) : avertissement puis création confirmée, référence 002', async () => {
  await remplir(page);
  await page.click('#enregistrer');
  await page.waitForSelector('[data-test=cree]');
  await remplir(page, { adresse: '3 chemin du Lac', clientNom: 'Dupont J.' });
  await page.click('#enregistrer');
  await page.waitForSelector('[data-test=doublons]');
  assert.match(await page.textContent('[data-test=doublons]'), /même téléphone/);
  assert.equal(await nbDossiers(page), 1, 'rien créé tant que non confirmé');
  await remplir(page, { adresse: '3 chemin du Lac', clientNom: 'Dupont J.' });
  await page.click('#enregistrer');
  await page.click('[data-test=creer-quand-meme]');
  await page.waitForSelector('[data-test=cree]');
  assert.match(await page.textContent('[data-test=reference]'), /-002$/);
  assert.equal(await nbDossiers(page), 2);
});

test('brouillon restauré après rechargement / fermeture', async () => {
  await page.goto(url + '#/nouveau');
  await page.fill('#clientNom', 'Martin');
  await page.fill('#telephone', '0601020304');
  await page.check('input[name=typeChantier][value=neuf]');
  await page.reload();
  await page.waitForSelector('[data-test=brouillon-restaure]');
  assert.equal(await page.inputValue('#clientNom'), 'Martin');
  assert.equal(await page.inputValue('#telephone'), '0601020304');
  assert.equal(await page.isChecked('input[name=typeChantier][value=neuf]'), true);
});

test('échec d’enregistrement : message, saisies conservées, nouvelle tentative réussie', async () => {
  await remplir(page);
  await page.evaluate(() => {
    const orig = IDBObjectStore.prototype.add;
    let fois = 0;
    IDBObjectStore.prototype.add = function (...a) {
      if (fois++ === 0) throw new DOMException('Espace de stockage insuffisant (simulé)', 'QuotaExceededError');
      return orig.apply(this, a);
    };
  });
  await page.click('#enregistrer');
  await page.waitForSelector('[data-test=echec]');
  assert.match(await page.textContent('[data-test=echec]'), /saisies sont conservées/);
  assert.equal(await page.inputValue('#clientNom'), 'Dupont Jean');
  assert.equal(await page.isDisabled('#enregistrer'), false);
  await page.click('#enregistrer');
  await page.waitForSelector('[data-test=cree]');
  assert.equal(await nbDossiers(page), 1);
});

test('affichage smartphone : pas de défilement horizontal', async () => {
  await page.goto(url + '#/nouveau');
  const deborde = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  assert.equal(deborde, false);
});

test('fichiers internes non servis par le serveur', async () => {
  const r = await page.request.get(url + 'tests/e2e.test.js');
  assert.equal(r.status(), 404);
});
