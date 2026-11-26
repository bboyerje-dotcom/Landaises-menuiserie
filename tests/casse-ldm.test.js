import { test } from 'node:test';
import assert from 'node:assert/strict';
import { produit } from '../js/catalogue/produits.js';
import { normaliserOuvrageCatalogue, analyserOuvrageCatalogue } from '../js/domain/catalogue.js';
import { calculCasse, composition } from '../js/domain/casse.js';
import { SERIES_CASSE } from '../js/config/abaque-casse.js';
import { normaliserOuvrageComplet, analyserOuvrage } from '../js/domain/ouvrage.js';
import { resumeLdm, valeursFormLdm } from '../js/catalogue/fiche-ldm.js';

const R = { valide: true, nbMesuresParDimension: 3, ecartMaxEntreMesuresMm: 10, ecartMaxDiagonalesMm: 10, coteMinMm: 200, coteMaxMm: 6000 };
const P = produit('casse_vitrage');
const casse = (cotes = {}, options = {}) => ({ cotes: { ...cotes }, options: { ...options } });

test('abaque : valeurs du document du 27/04/2022', () => {
  assert.deepEqual([SERIES_CASSE.gy.dL, SERIES_CASSE.gy.dH], [28, 28]);
  assert.deepEqual([SERIES_CASSE.gx_gxi.dL, SERIES_CASSE.gx_gxi.dH], [27, 23]);
  assert.deepEqual([SERIES_CASSE.gk_sv.dL, SERIES_CASSE.fc.dL, SERIES_CASSE.py.dL], [16, 31, 32]);
  assert.deepEqual(SERIES_CASSE.pvc.plage, [30, 35]);
  assert.equal(SERIES_CASSE.alu_frappe.dL, -8);
});

test('GY, CDV 1200 × 1600 → nette indicative 1228 × 1628 (comme votre exemple)', () => {
  const r = calculCasse(casse({ CDVL: 1200, CDVH: 1600, EP: 24 }, { serie: 'gy', verreExt: 'v4', intercalaire: 'i16', verreInt: 'v4' }));
  assert.deepEqual(r.nette, { L: 1228, H: 1628 });
  assert.deepEqual([r.manquants, r.alertes], [[], []]);
  assert.match(r.lignes.map((l) => l.join(' ')).join(' | '), /4 mm \/ 16 mm \/ 4 mm → 24 mm.*1228 × 1628 mm \(CDV \+28 \/ \+28\).*indicatif/);
});

test('GX/GXI : écarts différents en largeur et hauteur', () => {
  assert.deepEqual(calculCasse(casse({ CDVL: 1000, CDVH: 1000 }, { serie: 'gx_gxi' })).nette, { L: 1027, H: 1023 });
});

test('alu frappe : fond de feuillure −8 ; CDV seul → manque FF', () => {
  assert.deepEqual(calculCasse(casse({ FFL: 1000, FFH: 1200 }, { serie: 'alu_frappe' })).nette, { L: 992, H: 1192 });
  assert.match(calculCasse(casse({ CDVL: 1000, CDVH: 1200 }, { serie: 'alu_frappe' })).manquants[0].msg, /Fond de feuillure/);
});

test('bois : CDV +22, ou à défaut fond de feuillure −6', () => {
  assert.deepEqual(calculCasse(casse({ CDVL: 800, CDVH: 900 }, { serie: 'bois' })).nette, { L: 822, H: 922 });
  assert.deepEqual(calculCasse(casse({ FFL: 800, FFH: 900 }, { serie: 'bois' })).nette, { L: 794, H: 894 });
});

test('PVC : plage +30 à +35, pas de cote unique, alerte', () => {
  const r = calculCasse(casse({ CDVL: 1000, CDVH: 1000 }, { serie: 'pvc' }));
  assert.equal(r.nette, null);
  assert.match(r.lignes[0][1], /entre 1030 × 1030 et 1035 × 1035/);
  assert.ok(r.alertes.some((a) => /écart variable/.test(a.msg)));
});

test('alu coulissant / PE / PPM : pas de règle → alerte', () => {
  for (const s of ['alu_coulissant', 'pe', 'ppm']) assert.ok(calculCasse(casse({ CDVL: 1000, CDVH: 1000 }, { serie: s })).alertes.some((a) => /pas de règle/.test(a.msg)), s);
});

test('épaisseur : composition 33.2/12/4 = 22,8 ≠ 24 mesurés → alerte ; série prévue en 24 → alerte', () => {
  const r = calculCasse(casse({ CDVL: 1000, CDVH: 1000, EP: 24 }, { serie: 'gy', verreExt: 'f332', intercalaire: 'i12', verreInt: 'v4' }));
  assert.ok(r.alertes.some((a) => /différente de la composition \(22,8 mm\)/.test(a.msg)));
  const r2 = calculCasse(casse({ CDVL: 1000, CDVH: 1000, EP: 28.8 }, { serie: 'gy', verreExt: 'f442', intercalaire: 'i16', verreInt: 'v4' }));
  assert.ok(r2.alertes.some((a) => /prévoit un vitrage de 24 mm/.test(a.msg)));
  assert.equal(composition({ verreExt: 'v4', intercalaire: 'sv' }).e, 4);
});

test('cote nette relevée sur l’ancien vitrage différente de l’abaque → alerte', () => {
  const r = calculCasse(casse({ CDVL: 1200, CDVH: 1600, NL: 1220, NH: 1628 }, { serie: 'gy' }));
  assert.ok(r.alertes.some((a) => /différente de l’abaque/.test(a.msg)));
});

test('produit casse : épaisseur décimale acceptée, calcul intégré au statut', () => {
  const o = normaliserOuvrageCatalogue({ repere: 'V1', cote_CDVL: '1200', cote_CDVH: '1600', cote_EP: '28,8', opt_serie: 'gy' }, P);
  assert.equal(o.cotes.EP, 28.8);
  const a = analyserOuvrageCatalogue(o, P, { regles: R, photos: [] });
  assert.equal(a.erreurs.cote_EP, undefined);
  assert.deepEqual(a.calcul.nette, { L: 1228, H: 1628 });
  assert.ok(a.alertes.some((x) => /24 mm/.test(x.msg)));
  assert.equal(a.largeurRetenue, 1200, 'retenue = clair de vitre (le FF n’entre pas dans le mini)');
});

// ---- Fiche LDM (fenêtre)
const fen = (o = {}) => ({
  id: 'o1', typologie: 'fenetre', repere: 'F1', localisation: 'Séjour', typePose: 'renovation', poseConfirmee: true, etatDormant: 'bon',
  pointDeVueMesure: 'interieur', referenceMesure: 'dormant_existant', L1: '1200', L2: '1198', L3: '1201', H1: '1350', H2: '1352', H3: '1349',
  typeOuverture: 'francaise', nbVantaux: '2', sens: 'droite', sensVueDe: 'interieur', materiau: 'alu', colorisInt: 'Blanc', colorisExt: 'RAL 7016',
  ldm_gamme: 'g65', ldm_natureCotes: 'dp', ldm_appui: 'rentrant', ldm_poignee: 'gy_standard', ldm_fermeture: 'pts3', ...o,
});
const anF = (o) => analyserOuvrage(normaliserOuvrageComplet(fen(o)), { regles: R, photos: ['exterieur', 'interieur'] });

test('fenêtre + fiche LDM complète → COMPLET', () => {
  const a = anF();
  assert.deepEqual([a.manquants, a.alertes], [[], []]);
});

test('fiche LDM : nature des cotes, gamme (alu), appui, poignée, fermeture obligatoires', () => {
  const a = anF({ ldm_gamme: '', ldm_natureCotes: '', ldm_appui: '', ldm_poignee: '', ldm_fermeture: '' });
  const m = a.manquants.map((x) => x.msg).join(' | ');
  for (const t of ['Gamme', 'Nature des cotes', 'Appui', 'Poignée', 'Fermeture']) assert.match(m, new RegExp(t));
  assert.ok(!anF({ materiau: 'pvc', ldm_gamme: '' }).manquants.some((x) => /Gamme/.test(x.msg)), 'gamme non exigée hors alu');
  assert.ok(!anF({ typeOuverture: 'fixe', sens: '', ldm_poignee: '', ldm_fermeture: '' }).manquants.some((x) => /Poignée|Fermeture/.test(x.msg)), 'fixe : ni poignée ni fermeture');
});

test('fiche LDM : appui pour fenêtre, seuil pour porte-fenêtre ; valeurs non applicables vidées', () => {
  const pf = normaliserOuvrageComplet(fen({ typologie: 'porte_fenetre', ldm_appui: 'rentrant', ldm_allege: '900', ldm_seuil: 'S12' }));
  assert.equal(pf.ldm.appui, '');
  assert.equal(pf.ldm.allege, null);
  assert.equal(pf.ldm.seuil, 'S12');
  const f = normaliserOuvrageComplet(fen({ ldm_poignee: 'gy_standard', ldm_poigneeRef: 'XYZ' }));
  assert.equal(f.ldm.poigneeRef, '', 'réf. poignée vidée si poignée standard');
  const f2 = normaliserOuvrageComplet(fen({ ldm_poignee: 'autre', ldm_poigneeRef: 'XYZ' }));
  assert.equal(f2.ldm.poigneeRef, 'XYZ');
});

test('fiche LDM : cases (habillages, accessoires), mm invalides, résumé et rechargement', () => {
  const o = normaliserOuvrageComplet(fen({ ldm_habInt_G: true, ldm_habInt_D: 'on', ldm_habIntRef: 'CJ40', ldm_accessoires_canon: true, ldm_bavette: true, ldm_allege: '1150' }));
  assert.deepEqual(o.ldm.habInt, ['G', 'D']);
  assert.deepEqual(o.ldm.accessoires, ['canon']);
  const r = Object.fromEntries(resumeLdm(o));
  assert.equal(r['Habillage intérieur (couvre-joint)'], 'Gauche, Droite');
  assert.equal(r['Hauteur d’allège (sol fini → bas de baie)'], '1150 mm');
  assert.equal(r['Bavette'], 'Oui');
  const v = valeursFormLdm(o);
  assert.equal(v.ldm_habInt_G, true);
  assert.equal(v.ldm_habInt_H, false);
  assert.ok(anF({ ldm_allege: '1,15' }).erreurs.ldm_allege);
});
