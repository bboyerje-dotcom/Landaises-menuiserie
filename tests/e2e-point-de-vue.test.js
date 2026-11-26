// Point de vue choisi au cas par cas (intérieur / extérieur) et équivalent affiché.
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { demarrer } from '../server.mjs';
import { lireBase } from './aide-e2e.js';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }

let srv, url, browser, ctx, page;
before(async () => { srv = await demarrer(0); url = `http://127.0.0.1:${srv.address().port}/`; browser = await chromium.launch(); });
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

test('fenêtre : sens vu de l’extérieur → équivalent intérieur affiché, enregistré, imprimé et exporté', async () => {
  await dossier(page);
  await choisir(page, 'fenetre');
  await r(page, 'typeOuverture', 'francaise');
  await r(page, 'nbVantaux', '1');
  await r(page, 'sens', 'gauche');
  assert.match(await page.textContent('[data-test=apercu]'), /point de vue \(intérieur \/ extérieur\) non précisé/);
  await r(page, 'sensVueDe', 'exterieur');
  assert.match(await page.textContent('[data-test=eq-sens]'), /Gauche \(vu de l’extérieur\) — soit droite vu de l’intérieur/);
  assert.match(await page.textContent('#vue-sens'), /vu de l’extérieur/);
  await page.click('#enregistrer-ouvrage');
  await page.waitForSelector('[data-test=ligne-ouvrage]');
  const [o] = await lireBase(page, 'ouvrages');
  assert.deepEqual([o.sens, o.sensVueDe], ['gauche', 'exterieur']);
  await page.click('[data-test=ouvrir-releve]');
  await page.waitForSelector('[data-test=sens-doc]');
  assert.match(await page.textContent('[data-test=sens-doc]'), /Sens d’ouverture \(vu de l’extérieur\)[\s\S]*soit droite vu de l’intérieur/);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-test=export-csv]')]);
  const csv = await readFile(await dl.path(), 'utf8');
  assert.match(csv, /Gauche \(vu de l’extérieur\) — soit droite vu de l’intérieur;Droite;/, 'colonne « ramené vu de l’intérieur » = Droite');
});

test('porte d’entrée : ouverture vue de l’intérieur → équivalent extérieur ; point de vue exigé', async () => {
  await dossier(page);
  await choisir(page, 'porte_entree');
  await r(page, 'opt_ouverture', 'tirant_d');
  assert.match(await page.textContent('[data-test=apercu]'), /Ouverture : point de vue \(intérieur \/ extérieur\) non précisé/);
  await r(page, 'opt_ouverture_vue', 'interieur');
  assert.match(await page.textContent('[data-test=eq-ouverture]'), /Tirant, paumelles à droite \(vu de l’intérieur\) — soit poussant, paumelles à gauche vu de l’extérieur/);
  assert.doesNotMatch(await page.textContent('[data-test=apercu]'), /Ouverture : point de vue/);
});

test('baie coulissante et volet : chaque option dépendant du côté a son choix intérieur / extérieur', async () => {
  await dossier(page);
  await choisir(page, 'baie_coulissante');
  assert.equal(await page.locator('input[name="opt_service_vue"]').count(), 2);
  await r(page, 'opt_service', 'd_vers_g');
  await r(page, 'opt_service_vue', 'exterieur');
  assert.match(await page.textContent('[data-test=eq-service]'), /soit gauche → droite vu de l’intérieur/);
  await page.goBack(); await page.goBack();
  await choisir(page, 'garage_laterale');
  assert.equal(await page.locator('input[name="opt_refoulement_vue"]').count(), 2);
});
