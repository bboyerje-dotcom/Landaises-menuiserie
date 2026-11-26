import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normaliserOuvrage, analyserOuvrage, lireMm, prochainRepere, trierParRepere } from '../js/domain/ouvrage.js';

const R = { valide: true, nbMesuresParDimension: 3, retenue: 'min', ecartMaxEntreMesuresMm: 10, ecartMaxDiagonalesMm: 10, coteMinMm: 200, coteMaxMm: 6000 };
const saisie = (o = {}) => ({
  id: 'o1', dossierId: 'd1', typologie: 'fenetre', repere: 'f1', localisation: 'Séjour', typePose: 'renovation',
  poseConfirmee: true, etatDormant: 'bon', pointDeVueMesure: 'interieur', referenceMesure: 'dormant_existant',
  L1: '1200', L2: '1 198', L3: '1201', H1: '1350', H2: '1352', H3: '1349', typeOuverture: 'francaise', nbVantaux: '2',
  sens: 'droite', materiau: 'alu', colorisInt: 'Blanc', colorisExt: 'RAL 7016', ...o,
});
const an = (o, ctx = {}) => analyserOuvrage(normaliserOuvrage(saisie(o)), { regles: R, ...ctx });

test('ouvrage complet → COMPLET, cotes retenues = plus petites', () => {
  const a = an();
  assert.deepEqual([a.manquants, a.alertes], [[], []]);
  assert.equal(a.statut, 'complet');
  assert.equal(a.largeurRetenue, 1198);
  assert.equal(a.hauteurRetenue, 1349);
});

test('repère normalisé en majuscules', () => assert.equal(normaliserOuvrage(saisie()).repere, 'F1'));

test('lecture des mm : virgule/point/lettres = erreur, espaces tolérés', () => {
  assert.equal(lireMm(''), null);
  assert.equal(lireMm('1 250'), 1250);
  assert.ok(Number.isNaN(lireMm('1,25')));
  assert.ok(Number.isNaN(lireMm('1.25')));
  assert.ok(Number.isNaN(lireMm('12cm')));
});

test('erreurs bloquantes : format, hors plage, repère vide ou en double, typologie', () => {
  const a = an({ L1: '1,2', H1: '120', repere: '', typologie: '' });
  assert.equal(a.valideEnregistrement, false);
  assert.deepEqual(Object.keys(a.erreurs).sort(), ['H1', 'L1', 'repere', 'typologie']);
  const b = an({}, { autres: [{ id: 'autre', repere: 'F1' }] });
  assert.match(b.erreurs.repere, /existe déjà/);
  assert.equal(an({}, { autres: [{ id: 'o1', repere: 'F1' }] }).valideEnregistrement, true, 'soi-même n’est pas un doublon');
});

test('ouvrage minimal enregistrable mais À VÉRIFIER avec la liste des manques', () => {
  const a = analyserOuvrage(normaliserOuvrage({ id: 'x', typologie: 'fenetre', repere: 'F1' }), { regles: R });
  assert.equal(a.valideEnregistrement, true);
  assert.equal(a.statut, 'a_verifier');
  const champs = a.manquants.map((m) => m.champ);
  for (const c of ['localisation', 'typeOuverture', 'nbVantaux', 'materiau', 'typePose', 'pointDeVueMesure', 'referenceMesure', 'L1', 'H1', 'sens', 'colorisInt', 'colorisExt'])
    assert.ok(champs.includes(c), c);
});

test('pose non confirmée par le client → À VÉRIFIER', () => {
  const a = an({ poseConfirmee: false });
  assert.equal(a.statut, 'a_verifier');
  assert.ok(a.manquants.some((m) => m.champ === 'poseConfirmee'));
});

test('mesures incomplètes (2/3) → À VÉRIFIER', () => {
  assert.ok(an({ L3: '' }).manquants.some((m) => /2\/3 largeurs/.test(m.msg)));
});

test('écarts largeurs / hauteurs / diagonales au-delà du seuil → alertes', () => {
  const a = an({ L3: '1215', H2: '1370', D1: '1800', D2: '1825' });
  const msgs = a.alertes.map((x) => x.msg).join(' | ');
  assert.match(msgs, /17 mm entre les largeurs/);
  assert.match(msgs, /21 mm entre les hauteurs/);
  assert.match(msgs, /25 mm entre diagonales/);
  assert.equal(an({ D1: '1800', D2: '1805' }).statut, 'complet', 'écart sous le seuil accepté');
});

test('porte-fenêtre plus large que haute → alerte inversion ; fenêtre large → pas d’alerte', () => {
  const pf = an({ typologie: 'porte_fenetre', L1: '2150', L2: '2150', L3: '2150', H1: '900', H2: '900', H3: '900' });
  assert.ok(pf.alertes.some((x) => /inversées/.test(x.msg)));
  const f = an({ L1: '2150', L2: '2150', L3: '2150', H1: '900', H2: '900', H3: '900' });
  assert.ok(!f.alertes.some((x) => /inversées/.test(x.msg)));
});

test('référence de mesure incohérente avec le type de pose', () => {
  assert.ok(an({ referenceMesure: 'tableau' }).alertes.some((x) => x.champ === 'referenceMesure'));
  assert.ok(an({ typePose: 'depose_totale', referenceMesure: 'dormant_existant' }).alertes.some((x) => x.champ === 'referenceMesure'));
  assert.equal(an({ typePose: 'depose_totale', referenceMesure: 'tableau' }).statut, 'complet');
});

test('rénovation : état du dormant obligatoire, « mauvais » → alerte', () => {
  assert.ok(an({ etatDormant: '' }).manquants.some((m) => m.champ === 'etatDormant'));
  assert.ok(an({ etatDormant: 'mauvais' }).alertes.some((m) => m.champ === 'etatDormant'));
  assert.ok(!an({ typePose: 'depose_totale', referenceMesure: 'tableau', etatDormant: '' }).manquants.some((m) => m.champ === 'etatDormant'));
});

test('client hésitant : cotes alternatives requises', () => {
  assert.ok(an({ hesitationPose: true }).manquants.some((m) => m.champ === 'altL'));
  assert.equal(an({ hesitationPose: true, altL: '1260', altH: '1400' }).statut, 'complet');
});

test('fixe : sens non requis ; sens saisi sur fixe → alerte', () => {
  assert.equal(an({ typeOuverture: 'fixe', sens: '' }).statut, 'complet');
  assert.ok(an({ typeOuverture: 'fixe' }).alertes.some((m) => m.champ === 'sens'));
});

test('chantier neuf avec pose rénovation → alerte', () => {
  assert.ok(an({}, { dossier: { typeChantier: 'neuf' } }).alertes.some((m) => m.champ === 'typePose'));
});

test('matériau ou coloris « à définir » → alerte', () => {
  assert.ok(an({ materiau: 'a_definir' }).alertes.some((m) => m.champ === 'materiau'));
  assert.ok(an({ colorisExt: 'à définir' }).alertes.some((m) => m.champ === 'colorisInt'));
});

test('repères proposés et tri naturel', () => {
  assert.equal(prochainRepere('fenetre', [{ repere: 'F1' }, { repere: 'F2' }]), 'F3');
  assert.equal(prochainRepere('porte_fenetre', [{ repere: 'F1' }]), 'PF1');
  assert.deepEqual([{ repere: 'F10' }, { repere: 'F2' }, { repere: 'F1' }].sort(trierParRepere).map((x) => x.repere), ['F1', 'F2', 'F10']);
});
