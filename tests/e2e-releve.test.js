// Étape 4 — document de relevé (PDF) et export ProDevis, dans Chromium.
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { demarrer } from '../server.mjs';
import { imageJpeg } from './aide-e2e.js';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }

let srv, url, browser, ctx, page, IMG64;
before(async () => {
  srv = await demarrer(0);
  url = `http://127.0.0.1:${srv.address().port}/`;
  browser = await chromium.launch();
  IMG64 = (await imageJpeg(browser, 1200, 900, 'Facade')).toString('base64');
});
after(async () => { await browser?.close(); srv?.close(); });
beforeEach(async () => {
  await ctx?.close();
  ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  page = await ctx.newPage();
  page.on('pageerror', (e) => { throw e; });
});

// Jeu de données inséré directement en base (les écrans de saisie sont testés ailleurs).
async function seed(p, { ouvrages = true, photoCassee = false } = {}) {
  await p.goto(url);
  await p.waitForSelector('h1');
  await p.evaluate(([img64, avecOuvrages, cassee]) => new Promise((ok, ko) => {
    const r = indexedDB.open('pilotage-terrain');
    r.onsuccess = () => {
      const db = r.result;
      const tx = db.transaction(['dossiers', 'ouvrages', 'photos'], 'readwrite');
      tx.objectStore('dossiers').add({ id: 'd1', reference: 'LDM-261126-001', clientNom: 'Dupont Jean', telephone: '0612345678', email: '', adresse: '12 rue des Pins', codePostal: '40000', commune: 'Mont-de-Marsan', responsable: 'B. Test', dateRdv: '2026-11-26', typeChantier: 'renovation', natureBatiment: 'maison', description: 'Remplacement fenêtres', contraintes: '', statut: 'releve_en_cours', creeLe: '2026-11-26T09:00:00Z' });
      if (avecOuvrages) {
        const base = { dossierId: 'd1', niveau: 'RDC', typeOuverture: 'francaise', nbVantaux: 2, materiau: 'alu', typePose: 'renovation', poseConfirmee: true, poseConfirmeeLe: '2026-11-26T10:00:00Z', hesitationPose: false, pointDeVueMesure: 'interieur', referenceMesure: 'dormant_existant', diagonales: [null, null], etatDormant: 'bon', alt: { largeur: null, hauteur: null }, colorisInt: 'Blanc', colorisExt: 'RAL 7016', vitrage: '', observations: '', version: 1, creeLe: '2026-11-26T10:00:00Z', modifieLe: '2026-11-26T10:00:00Z', historique: [] };
        tx.objectStore('ouvrages').add({ ...base, id: 'o1', repere: 'F1', typologie: 'fenetre', localisation: 'Séjour', sens: 'droite', largeurs: [1200, 1198, 1201], hauteurs: [1350, 1352, 1349], largeurRetenue: 1198, hauteurRetenue: 1349, statut: 'complet', pointsAVerifier: [] });
        tx.objectStore('ouvrages').add({ ...base, id: 'o2', repere: 'PF1', typologie: 'porte_fenetre', localisation: '=1+1', sens: '', poseConfirmee: false, largeurs: [900, 905, null], hauteurs: [2150, 2150, 2150], largeurRetenue: 900, hauteurRetenue: 2150, statut: 'a_verifier', pointsAVerifier: ['Sens d’ouverture non renseigné.', 'Type de pose non confirmé par le client.'] });
        const octets = cassee ? new TextEncoder().encode('pas une image').buffer : Uint8Array.from(atob(img64), (c) => c.charCodeAt(0)).buffer;
        tx.objectStore('photos').add({ id: 'p1', ouvrageId: 'o1', dossierId: 'd1', categorie: 'exterieur', legende: 'Façade nord', type: 'image/jpeg', donnees: octets, miniature: octets, creeLe: '2026-11-26T10:01:00Z' });
      }
      tx.oncomplete = () => { db.close(); ok(); };
      tx.onerror = () => ko(tx.error);
    };
  }), [IMG64, ouvrages, photoCassee]);
  await p.goto(url + '#/dossier/d1');
  await p.click('[data-test=ouvrir-releve]');
  await p.waitForSelector('[data-test=document]');
  await p.waitForFunction(() => !document.querySelector('[data-test=imprimer]').disabled);
}

test('document : en-tête, avertissement, synthèse, une fiche par ouvrage, photo affichée', async () => {
  await seed(page);
  const doc = await page.textContent('[data-test=document]');
  assert.match(doc, /LDM-261126-001/);
  assert.match(await page.textContent('[data-test=avertissement]'), /ni des cotes de fabrication, ni une commande/);
  assert.equal(await page.locator('[data-test=synthese] tbody tr').count(), 2);
  assert.equal(await page.locator('[data-test=fiche-ouvrage]').count(), 2);
  assert.match(doc, /Confirmée par le client\s*Oui, le 26\/11\/2026/);
  assert.match(doc, /Vantail de service : droite/);
  assert.match(doc, /Sens d’ouverture non renseigné/);
  assert.match(doc, /Façade nord/);
  assert.ok(await page.$eval('img[data-photo]', (i) => i.complete && i.naturalWidth === 1200), 'photo décodée');
  assert.match(await page.textContent('[data-test=alerte-a-verifier]'), /1 ouvrage À VÉRIFIER/);
});

test('export ProDevis : CSV Excel (BOM, « ; »), 1 ligne par ouvrage, formule neutralisée, double-clic = 1 fichier', async () => {
  await seed(page);
  const fichiers = [];
  page.on('download', (d) => fichiers.push(d));
  await page.evaluate(() => { const b = document.querySelector('[data-test=export-csv]'); b.click(); b.click(); });
  await page.waitForSelector('[data-test=export-ok]');
  await page.waitForTimeout(500);
  assert.equal(fichiers.length, 1);
  assert.match(fichiers[0].suggestedFilename(), /^LDM-261126-001_export-prodevis_\d{8}-\d{4}\.csv$/);
  const csv = await readFile(await fichiers[0].path(), 'utf8');
  assert.ok(csv.startsWith('﻿'));
  const lignes = csv.slice(1).trim().split('\r\n');
  assert.equal(lignes.length, 3);
  assert.match(lignes[0], /^Réf\. dossier;Client;/);
  assert.match(lignes[1], /;F1;Séjour;RDC;Fenêtre;Aluminium;.*;1198;1349;/);
  assert.match(lignes[2], /;'=1\+1;/);
  assert.match(lignes[2], /À VÉRIFIER/);
  assert.match(await page.textContent('[data-test=export-ok]'), /2 lignes, dont 1 À VÉRIFIER/);
});

test('PDF : généré, plusieurs pages A4, boutons masqués à l’impression', async () => {
  await seed(page);
  await page.emulateMedia({ media: 'print' });
  assert.equal(await page.isVisible('[data-test=imprimer]'), false);
  const pdf = await page.pdf({ format: 'A4', printBackground: true });
  assert.equal(pdf.subarray(0, 4).toString(), '%PDF');
  const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
  assert.ok(pages >= 3, `${pages} pages (synthèse + 1 page par ouvrage)`);
});

test('bouton Imprimer / PDF ouvre l’impression du navigateur', async () => {
  await seed(page);
  await page.evaluate(() => { window.__imprime = 0; window.print = () => { window.__imprime++; }; });
  await page.click('[data-test=imprimer]');
  assert.equal(await page.evaluate(() => window.__imprime), 1);
});

test('dossier sans ouvrage : message, export désactivé, fiche client présente', async () => {
  await seed(page, { ouvrages: false });
  assert.ok(await page.isVisible('[data-test=aucun-ouvrage]'));
  assert.equal(await page.isDisabled('[data-test=export-csv]'), true);
  assert.match(await page.textContent('[data-test=document]'), /Dupont Jean/);
});

test('photo illisible : signalée, le document reste imprimable', async () => {
  await seed(page, { photoCassee: true });
  assert.match(await page.textContent('[data-test=document]'), /Photo illisible/);
  assert.equal(await page.isDisabled('[data-test=imprimer]'), false);
});

test('dossier introuvable : message clair', async () => {
  await page.goto(url + '#/dossier/inexistant/releve');
  await page.waitForSelector('.bandeau.erreur');
  assert.match(await page.textContent('.bandeau.erreur'), /introuvable/);
});

test('document lisible sur smartphone : pas de défilement horizontal', async () => {
  await seed(page);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
});
