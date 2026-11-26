// Corrections issues de la revue de la demande de fusion n°1.
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { demarrer } from '../server.mjs';
import { imageJpeg, ajouterPhoto, variante, lireBase } from './aide-e2e.js';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }

let srv, url, browser, ctx, page, IMG;
before(async () => { srv = await demarrer(0); url = `http://127.0.0.1:${srv.address().port}/`; browser = await chromium.launch(); IMG = await imageJpeg(browser); });
after(async () => { await browser?.close(); srv?.close(); });
beforeEach(async () => {
  await ctx?.close();
  ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  page = await ctx.newPage();
  page.setDefaultTimeout(10000);
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(e));
  page.erreurs = erreurs;
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
// Ralentit la compression des photos (simule un téléphone lent).
const ralentirPhotos = (p, ms) => p.evaluate((d) => {
  const orig = window.createImageBitmap;
  window.createImageBitmap = (...a) => new Promise((ok) => setTimeout(() => ok(orig(...a)), d));
}, ms);
async function attendreBase(p, store, cond) {
  for (let i = 0; i < 40; i++) { const t = await lireBase(p, store); if (cond(t)) return t; await p.waitForTimeout(150); }
  throw new Error('condition non atteinte en base');
}

test('relevé guidé : changer la pose décoche la confirmation, y compris après rechargement', async () => {
  await dossier(page);
  await choisir(page, 'baie_coulissante');
  await page.check('input[name="typePose"][value="renovation"]');
  await page.check('#poseConfirmee');
  await page.check('input[name="typePose"][value="depose_totale"]');
  assert.equal(await page.isChecked('#poseConfirmee'), false);
  assert.match(await page.textContent('[data-test=apercu]'), /non confirmé par le client/);
  await page.reload();
  await page.waitForSelector('[data-test=brouillon-restaure]');
  assert.equal(await page.isChecked('input[name="typePose"][value="depose_totale"]'), true);
  assert.equal(await page.isChecked('#poseConfirmee'), false, 'la nouvelle pose ne doit pas revenir confirmée');
});

for (const [produit, form] of [['baie_coulissante', '#fc'], ['fenetre', '#fo']]) {
  test(`${produit} : enregistrement refusé tant qu’une photo est en cours de traitement`, async () => {
    await dossier(page);
    await choisir(page, produit);
    await ralentirPhotos(page, 1500);
    await page.setInputFiles('[data-test=camera-exterieur]', { name: 'a.jpg', mimeType: 'image/jpeg', buffer: IMG });
    await page.click('#enregistrer-ouvrage');
    await page.waitForSelector('[data-test=photo-en-cours]');
    assert.equal((await lireBase(page, 'ouvrages')).length, 0);
    await page.waitForFunction(() => /1 photo/.test(document.querySelector('[data-test=nb-exterieur]')?.textContent || ''));
    await page.click('#enregistrer-ouvrage');
    await page.waitForSelector('[data-test=ligne-ouvrage]');
    const [o] = await lireBase(page, 'ouvrages');
    assert.ok(!o.pointsAVerifier.some((x) => /Vue extérieure/.test(x)), 'la photo extérieure est prise en compte');
    assert.equal(page.erreurs.length, 0, page.erreurs.map(String).join());
    void form;
  });

  test(`${produit} : écran quitté pendant le traitement d’une photo → statut en base quand même à jour, sans erreur`, async () => {
    await dossier(page);
    await choisir(page, produit);
    await page.click('#enregistrer-ouvrage'); // ouvrage enregistré sans photo
    await page.waitForSelector('[data-test=ligne-ouvrage]');
    await page.click('[data-test=ligne-ouvrage]');
    await page.waitForSelector('[data-test=nb-exterieur]');
    await ralentirPhotos(page, 1200);
    await page.setInputFiles('[data-test=camera-exterieur]', { name: 'a.jpg', mimeType: 'image/jpeg', buffer: variante(IMG, produit) });
    await page.goBack(); // retour au dossier avant la fin du traitement
    await page.waitForSelector('[data-test=ligne-ouvrage]');
    const [o] = await attendreBase(page, 'ouvrages', (t) => t[0]?.historique?.some((h) => /photos modifiées/.test(h.action)));
    assert.ok(!o.pointsAVerifier.some((x) => /Vue extérieure/.test(x)), 'statut recalculé avec la photo');
    assert.equal((await lireBase(page, 'photos')).length, 1);
    assert.equal(page.erreurs.length, 0, page.erreurs.map(String).join());
  });
}
