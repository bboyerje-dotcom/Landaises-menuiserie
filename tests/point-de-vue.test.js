import { test } from 'node:test';
import assert from 'node:assert/strict';
import { equivalent, texteAvecVue, versVue, vuDe, INVERSE_GD } from '../js/domain/point-de-vue.js';
import { produit } from '../js/catalogue/produits.js';
import { normaliserOuvrageCatalogue, analyserOuvrageCatalogue, texteOption } from '../js/domain/catalogue.js';
import { normaliserOuvrage, analyserOuvrage } from '../js/domain/ouvrage.js';

const R = { valide: true, nbMesuresParDimension: 3, ecartMaxEntreMesuresMm: 10, ecartMaxDiagonalesMm: 10, coteMinMm: 200, coteMaxMm: 6000 };
const SENS = { gauche: 'Gauche', droite: 'Droite' };

test('équivalent vu de l’autre côté : gauche ↔ droite', () => {
  assert.deepEqual(equivalent('gauche', INVERSE_GD, 'exterieur'), { valeur: 'droite', vue: 'interieur' });
  assert.equal(equivalent('gauche', INVERSE_GD, ''), null, 'pas d’équivalent sans point de vue');
  assert.equal(texteAvecVue('gauche', SENS, INVERSE_GD, 'exterieur'), 'Gauche (vu de l’extérieur) — soit droite vu de l’intérieur');
  assert.equal(versVue('gauche', INVERSE_GD, 'exterieur', 'interieur'), 'droite');
  assert.equal(versVue('gauche', INVERSE_GD, 'interieur', 'interieur'), 'gauche');
  assert.equal(vuDe(''), 'point de vue non précisé');
});

test('porte d’entrée : poussant paumelles à gauche (ext.) = tirant paumelles à droite (int.)', () => {
  const op = produit('porte_entree').options.find((o) => o.id === 'ouverture');
  assert.equal(texteOption(op, { ouverture: 'poussant_g', ouverture_vue: 'exterieur' }),
    'Poussant, paumelles à gauche (vu de l’extérieur) — soit tirant, paumelles à droite vu de l’intérieur');
});

test('baie coulissante : droite → gauche (ext.) = gauche → droite (int.)', () => {
  const op = produit('baie_coulissante').options.find((o) => o.id === 'service');
  assert.match(texteOption(op, { service: 'd_vers_g', service_vue: 'exterieur' }), /soit gauche → droite vu de l’intérieur/);
});

test('option dépendant du côté : point de vue exigé dès qu’une valeur est choisie', () => {
  const p = produit('vr_traditionnel');
  const base = { repere: 'V1', opt_coteManoeuvre: 'gauche' };
  const a = analyserOuvrageCatalogue(normaliserOuvrageCatalogue(base, p), p, { regles: R });
  assert.ok(a.manquants.some((m) => /Côté manœuvre \/ moteur : point de vue/.test(m.msg)));
  const b = analyserOuvrageCatalogue(normaliserOuvrageCatalogue({ ...base, opt_coteManoeuvre_vue: 'exterieur' }, p), p, { regles: R });
  assert.ok(!b.manquants.some((m) => /point de vue/.test(m.msg)));
  const o = normaliserOuvrageCatalogue({ repere: 'V1', opt_coteManoeuvre_vue: 'exterieur' }, p);
  assert.equal(o.options.coteManoeuvre_vue, '', 'point de vue sans valeur : non enregistré');
});

test('fenêtre : sens exigé avec son point de vue ; fixe : ni l’un ni l’autre', () => {
  const f = { repere: 'F1', typologie: 'fenetre', typeOuverture: 'francaise', sens: 'gauche' };
  assert.ok(analyserOuvrage(normaliserOuvrage(f), { regles: R }).manquants.some((m) => m.champ === 'sensVueDe'));
  assert.ok(!analyserOuvrage(normaliserOuvrage({ ...f, sensVueDe: 'exterieur' }), { regles: R }).manquants.some((m) => m.champ === 'sensVueDe'));
  assert.ok(!analyserOuvrage(normaliserOuvrage({ ...f, typeOuverture: 'fixe', sens: '' }), { regles: R }).manquants.some((m) => /sens|Sens/.test(m.champ)));
});
