// Étape 6 — fiche LDM (fenêtre) et remplacement de casse (abaque interne).
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { demarrer } from '../server.mjs';
import { imageJpeg, ajouterPhoto, variante, lireBase, remplirLdm } from './aide-e2e.js';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }

let srv, url, browser, ctx, page, IMG;
before(async () => { srv = await demarrer(0); url = `http://127.0.0.1:${srv.address().port}/`; browser = await chromium.launch(); IMG = await imageJpeg(browser); });
after(async () => { await browser?.close(); srv?.close(); });
beforeEach(async () => {
  await ctx?.close();
  ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
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
const r = (p, n, v) => p.check(`input[name="${n}"][value="${v}"]`);
const visible = (p, id) => p.isVisible(`[data-ldm="${id}"]`);

async function fenetreComplete(p) {
  await p.fill('#localisation', 'Séjour');
  await r(p, 'typePose', 'renovation'); await p.check('#poseConfirmee'); await r(p, 'etatDormant', 'bon');
  await r(p, 'pointDeVueMesure', 'interieur'); await r(p, 'referenceMesure', 'dormant_existant');
  for (const [k, v] of Object.entries({ L1: '1200', L2: '1198', L3: '1201', H1: '1350', H2: '1352', H3: '1349' })) await p.fill('#' + k, v);
  await r(p, 'typeOuverture', 'francaise'); await r(p, 'nbVantaux', '2'); await r(p, 'sens', 'droite'); await r(p, 'sensVueDe', 'interieur'); await r(p, 'materiau', 'alu');
  await p.fill('#colorisInt', 'Blanc'); await p.fill('#colorisExt', 'RAL 7016');
  await ajouterPhoto(p, 'exterieur', variante(IMG, 'e'), 'e.jpg');
  await ajouterPhoto(p, 'interieur', variante(IMG, 'i'), 'i.jpg');
}

test('fiche LDM : champs adaptés (appui/allège fenêtre, seuil porte-fenêtre, poignée si ouvrant, réf. si « autre »)', async () => {
  await dossier(page);
  await choisir(page, 'fenetre');
  assert.ok(await page.isVisible('[data-test=fiche-ldm]'));
  assert.equal(await visible(page, 'appui'), true);
  assert.equal(await visible(page, 'allege'), true);
  assert.equal(await visible(page, 'seuil'), false);
  await r(page, 'typologie', 'porte_fenetre');
  assert.equal(await visible(page, 'appui'), false);
  assert.equal(await visible(page, 'seuil'), true);
  await r(page, 'typeOuverture', 'fixe');
  assert.equal(await visible(page, 'poignee'), false);
  await r(page, 'typeOuverture', 'francaise');
  assert.equal(await visible(page, 'poigneeRef'), false);
  await r(page, 'ldm_poignee', 'autre');
  assert.equal(await visible(page, 'poigneeRef'), true);
  assert.equal(await visible(page, 'habIntRef'), false);
  await page.check('input[name="ldm_habInt_G"]');
  assert.equal(await visible(page, 'habIntRef'), true);
});

test('fiche LDM : obligatoire pour COMPLET, enregistrée, rechargée, et imprimée dans le relevé', async () => {
  await dossier(page);
  await choisir(page, 'fenetre');
  await fenetreComplete(page);
  const apercu = await page.textContent('[data-test=apercu]');
  assert.match(apercu, /Nature des cotes transmises : non renseigné/);
  assert.match(apercu, /Gamme : non renseigné/);
  await remplirLdm(page);
  await page.check('input[name="ldm_habInt_G"]'); await page.check('input[name="ldm_habInt_D"]');
  await page.fill('#ldm_habIntRef', 'CJ 40');
  await page.fill('#ldm_allege', '1150');
  await r(page, 'ldm_voletRoulant', 'tradi_tunnel_300');
  await page.fill('#quantite', '2');
  assert.match(await page.textContent('[data-test=apercu]'), /COMPLET/);
  await page.click('#enregistrer-ouvrage');
  await page.waitForSelector('[data-test=ligne-ouvrage]');
  assert.match(await page.textContent('[data-test=ligne-ouvrage]'), /F1 · Fenêtre ×2/);
  const [o] = await lireBase(page, 'ouvrages');
  assert.deepEqual(o.ldm.habInt, ['G', 'D']);
  assert.equal(o.ldm.allege, 1150);
  assert.equal(o.quantite, 2);
  await page.click('[data-test=ligne-ouvrage]');
  await page.waitForSelector('#fo');
  assert.equal(await page.isChecked('input[name="ldm_habInt_D"]'), true);
  assert.equal(await page.inputValue('#ldm_habIntRef'), 'CJ 40');
  await page.goBack();
  await page.click('[data-test=ouvrir-releve]');
  await page.waitForSelector('[data-test=ldm-doc]');
  const doc = await page.textContent('[data-test=ldm-doc]');
  assert.match(doc, /Fiche LDM — quantité 2/);
  assert.match(doc, /Nature des cotes transmises\s*DP/);
  assert.match(doc, /Habillage intérieur \(couvre-joint\)\s*Gauche, Droite/);
  assert.match(doc, /Tradi coffre tunnel 300 mm/);
});

test('cotes « nettes à fabriquer » : avertissement de validation technique dans le relevé', async () => {
  await dossier(page);
  await choisir(page, 'fenetre');
  await r(page, 'ldm_natureCotes', 'nettes');
  await page.click('#enregistrer-ouvrage');
  await page.waitForSelector('[data-test=ligne-ouvrage]');
  await page.click('[data-test=ouvrir-releve]');
  await page.waitForSelector('[data-test=ldm-doc]');
  assert.match(await page.textContent('[data-test=ldm-doc]'), /nettes à fabriquer.*validation technique obligatoire/);
});

test('remplacement de casse : GY, CDV 1200 × 1600, 4/16/4 → 1228 × 1628 indicatif, dans le relevé et l’export', async () => {
  await dossier(page);
  await choisir(page, 'casse_vitrage');
  assert.equal(await page.inputValue('#repere'), 'V1');
  await r(page, 'opt_serie', 'gy');
  await page.fill('#cote_CDVL', '1200');
  await page.fill('#cote_CDVH', '1600');
  await page.fill('#cote_EP', '24');
  await r(page, 'opt_verreExt', 'v4'); await r(page, 'opt_intercalaire', 'i16'); await r(page, 'opt_verreInt', 'v4');
  const calc = await page.textContent('[data-test=calcul]');
  assert.match(calc, /1228 × 1628 mm \(CDV \+28 \/ \+28\)/);
  assert.match(calc, /4 mm \/ 16 mm \/ 4 mm → 24 mm/);
  assert.match(calc, /Ne vaut pas cote de commande/);
  await page.fill('#localisation', 'Cuisine');
  await page.click('#enregistrer-ouvrage');
  await page.waitForSelector('[data-test=ligne-ouvrage]');
  const [o] = await lireBase(page, 'ouvrages');
  assert.deepEqual(o.calcul.nette, { L: 1228, H: 1628 });
  await page.click('[data-test=ouvrir-releve]');
  await page.waitForSelector('[data-test=calcul-doc]');
  assert.match(await page.textContent('[data-test=calcul-doc]'), /1228 × 1628/);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-test=export-csv]')]);
  const csv = await readFile(await dl.path(), 'utf8');
  assert.match(csv, /Cote nette indicative : 1228 × 1628 mm/);
});

test('remplacement de casse : simple vitrage masque le verre intérieur ; épaisseur décimale ; incohérence signalée', async () => {
  await dossier(page);
  await choisir(page, 'casse_vitrage');
  await r(page, 'opt_intercalaire', 'sv');
  assert.equal(await page.isVisible('[data-option="verreInt"]'), false);
  await r(page, 'opt_intercalaire', 'i16');
  assert.equal(await page.isVisible('[data-option="verreInt"]'), true);
  await r(page, 'opt_serie', 'gy');
  await r(page, 'opt_verreExt', 'f442'); await r(page, 'opt_verreInt', 'v4');
  await page.fill('#cote_EP', '28,8');
  const ap = await page.textContent('[data-test=apercu]');
  assert.match(ap, /prévoit un vitrage de 24 mm/);
  assert.doesNotMatch(ap, /différente de la composition/, '44.2 + 16 + 4 = 28,8 : cohérent');
  await page.fill('#cote_EP', '30');
  assert.match(await page.textContent('[data-test=apercu]'), /différente de la composition \(28,8 mm\)/);
});
