import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PRODUITS, produit, FAMILLES } from '../js/catalogue/produits.js';
import { TYPES_COTE } from '../js/catalogue/types-cotes.js';
import { penteDegres, pentePourcent, lireDegres, normaliserOuvrageCatalogue, analyserOuvrageCatalogue, optionVisible } from '../js/domain/catalogue.js';
import { illustration, svgCotesPhoto, traitParDefaut, versNormalise, depuisNormalise } from '../js/ui/dessin.js';

const R = { valide: true, nbMesuresParDimension: 3, ecartMaxEntreMesuresMm: 10, ecartMaxDiagonalesMm: 10, coteMinMm: 200, coteMaxMm: 6000 };

test('catalogue : les 20 produits (19 demandés + porte-fenêtre) sont présents', () => {
  const attendus = ['fenetre', 'porte_fenetre', 'baie_coulissante', 'porte_entree', 'garage_sectionnelle', 'garage_laterale', 'garage_enroulable',
    'vr_traditionnel', 'vr_tradi_tunnel', 'vr_monobloc', 'vr_blocbaie', 'volet_battant', 'store_banne_coffre', 'store_banne_monobloc', 'store_screen',
    'portail_coulissant', 'portail_battant', 'pergola_orientable', 'pergola_pleine', 'carport'];
  assert.deepEqual(PRODUITS.map((p) => p.id).sort(), attendus.sort());
});

test('catalogue : définitions cohérentes (familles, types, traits, identifiants uniques, préfixes uniques)', () => {
  const prefixes = new Set();
  for (const p of PRODUITS) {
    assert.ok(p.famille in FAMILLES, p.id);
    assert.ok(!prefixes.has(p.prefixe), `préfixe ${p.prefixe} en double`);
    prefixes.add(p.prefixe);
    const ids = new Set();
    for (const c of p.cotes) {
      assert.ok(c.type in TYPES_COTE, `${p.id}.${c.id} type`);
      assert.ok(!ids.has(c.id), `${p.id}.${c.id} en double`);
      ids.add(c.id);
      assert.equal(c.trait.length, 4);
      c.trait.forEach((v) => assert.ok(v >= 0 && v <= 300 && Number.isFinite(v), `${p.id}.${c.id} trait`));
      assert.ok(c.trait[1] <= 220 && c.trait[3] <= 220);
    }
    assert.ok(p.cotes.some((c) => c.type === 'largeur') && p.cotes.some((c) => c.type === 'hauteur'), `${p.id} a une largeur et une hauteur`);
    for (const o of p.options || []) assert.ok(Object.keys(o.choix).length, `${p.id}.${o.id}`);
  }
});

test('chaque produit produit une illustration SVG avec une cote par mesure', () => {
  for (const p of PRODUITS) {
    const s = illustration(p, {});
    assert.match(s, /^<svg/);
    assert.equal((s.match(/data-cote=/g) || []).length, p.cotes.length, p.id);
  }
});

test('pente : calcul en degrés et en %', () => {
  assert.equal(penteDegres(100, 100), 45);
  assert.equal(penteDegres(0, 500), 0);
  assert.equal(penteDegres(50, 1000), 2.9);
  assert.equal(penteDegres(10, 0), null);
  assert.equal(pentePourcent(45), 100);
  assert.equal(lireDegres('12,5'), 12.5);
  assert.ok(Number.isNaN(lireDegres('12°')));
});

test('photo : traits par défaut proportionnels, conversion normalisée réversible', () => {
  const p = produit('volet_battant');
  const t = traitParDefaut(p.cotes[0], 3000, 2200);
  assert.deepEqual(t.map(Math.round), p.cotes[0].trait.map((v) => v * 10));
  const n = versNormalise([300, 220, 1500, 1100], 3000, 2200);
  assert.deepEqual(depuisNormalise(n, 3000, 2200), [300, 220, 1500, 1100]);
  const svg = svgCotesPhoto(p, 3000, 2200, { L1: 1200 }, {}, { vue: 'VUE EXTÉRIEURE' });
  assert.equal((svg.match(/data-cote=/g) || []).length, 1, 'seules les cotes renseignées sont dessinées');
  assert.match(svg, /L1 1200/);
  assert.match(svg, /VUE EXTÉRIEURE/);
});

const saisieVolet = (o = {}) => ({
  id: 'x', dossierId: 'd', repere: 'vrt1', localisation: 'Salon', pointDeVueMesure: 'interieur', typePose: 'caisson_existant', poseConfirmee: true,
  cote_L1: '1200', cote_L2: '1203', cote_H1: '1500', cote_H2: '1502', cote_LC: '1180', cote_HC: '250', cote_PC: '260',
  opt_manoeuvre: 'radio', opt_coteManoeuvre: 'gauche', opt_alimentation: 'oui', opt_lames: 'alu', ...o,
});
const an = (o, ph = ['interieur', 'exterieur']) => {
  const p = produit('vr_traditionnel');
  return analyserOuvrageCatalogue(normaliserOuvrageCatalogue(saisieVolet(o), p), p, { regles: R, photos: ph });
};

test('volet traditionnel complet → COMPLET, retenues = mini', () => {
  const a = an();
  assert.deepEqual([a.manquants, a.alertes], [[], []]);
  assert.equal(a.statut, 'complet');
  assert.equal(a.largeurRetenue, 1200);
  assert.equal(a.hauteurRetenue, 1500);
});

test('cote obligatoire manquante, option manquante, photo manquante → À VÉRIFIER', () => {
  const a = an({ cote_HC: '', opt_lames: '' }, ['interieur']);
  const m = a.manquants.map((x) => x.msg).join(' | ');
  assert.match(m, /HC – Hauteur du caisson : non mesuré/);
  assert.match(m, /Lames : non renseigné/);
  assert.match(m, /Vue extérieure/);
});

test('option conditionnelle : alimentation demandée seulement si moteur filaire/radio', () => {
  const p = produit('vr_traditionnel');
  const alim = p.options.find((o) => o.id === 'alimentation');
  assert.equal(optionVisible(alim, { manoeuvre: 'sangle' }), false);
  assert.equal(optionVisible(alim, { manoeuvre: 'radio' }), true);
  const a = an({ opt_manoeuvre: 'sangle', opt_alimentation: '' });
  assert.ok(!a.manquants.some((x) => /Alimentation/.test(x.msg)));
  const o = normaliserOuvrageCatalogue(saisieVolet({ opt_manoeuvre: 'sangle', opt_alimentation: 'oui' }), p);
  assert.equal(o.options.alimentation, '', 'valeur masquée non enregistrée');
});

test('erreurs bloquantes : virgule en mm, hors plage, angle illisible ou > 60°', () => {
  assert.ok(an({ cote_L1: '1,2' }).erreurs.cote_L1);
  assert.ok(an({ cote_H1: '150' }).erreurs.cote_H1);
  const p = produit('store_banne_coffre');
  const o = normaliserOuvrageCatalogue({ repere: 'S1', cote_PE: '75', cote_LP: '4000' }, p);
  assert.match(analyserOuvrageCatalogue(o, p, { regles: R }).erreurs.cote_PE, /60°/);
  const o2 = normaliserOuvrageCatalogue({ repere: 'S1', cote_PE: '14,5' }, p);
  assert.equal(o2.cotes.PE, 14.5);
});

test('petites cotes (retour, tapée) acceptées sous le minimum largeur/hauteur', () => {
  const p = produit('porte_entree');
  const o = normaliserOuvrageCatalogue({ repere: 'P1', cote_T: '40', cote_RH: '25' }, p);
  const a = analyserOuvrageCatalogue(o, p, { regles: R });
  assert.equal(a.erreurs.cote_T, undefined);
  assert.equal(a.erreurs.cote_RH, undefined);
});

test('porte d’entrée plus large que haute → alerte inversion', () => {
  const p = produit('porte_entree');
  const v = { repere: 'P1', cote_L1: '2100', cote_L2: '2100', cote_L3: '2100', cote_H1: '950', cote_H2: '950', cote_H3: '950' };
  const a = analyserOuvrageCatalogue(normaliserOuvrageCatalogue(v, p), p, { regles: R });
  assert.ok(a.alertes.some((x) => /inversées/.test(x.msg)));
});

test('écart entre largeurs → alerte ; valeurs « à définir » → alerte', () => {
  assert.ok(an({ cote_L2: '1225' }).alertes.some((x) => /entre les largeurs/.test(x.msg)));
  assert.ok(an({ opt_manoeuvre: 'a_definir' }).alertes.some((x) => /Manœuvre/.test(x.msg)));
});
