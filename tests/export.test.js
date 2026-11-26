import { test } from 'node:test';
import assert from 'node:assert/strict';
import { celluleSure, versCsv, lignesExport, nomFichier } from '../js/domain/export.js';
import { COLONNES_PRODEVIS } from '../js/config/export-prodevis.js';

test('injection de formule neutralisée, nombres intacts', () => {
  for (const v of ['=1+1', '+33', '-2', '@SUM(A1)', '\t=x']) assert.equal(celluleSure(v)[0], "'", v);
  assert.equal(celluleSure(-5), '-5');
  assert.equal(celluleSure(1250), '1250');
  assert.equal(celluleSure(null), '');
  assert.equal(celluleSure('Séjour'), 'Séjour');
});

test('CSV Excel FR : BOM, « ; », guillemets, retours à la ligne, CRLF', () => {
  const csv = versCsv(['A', 'B'], [['x;y', 'il a dit "ok"'], ['ligne1\nligne2', 3]]);
  assert.ok(csv.startsWith('﻿'));
  assert.equal(csv.slice(1), 'A;B\r\n"x;y";"il a dit ""ok"""\r\n"ligne1\nligne2";3\r\n');
});

const dossier = { reference: 'LDM-261126-001', clientNom: 'Dupont', commune: 'Dax' };
const ouvrage = {
  id: 'o1', repere: 'F1', localisation: '=HYPERLINK("http://x")', typologie: 'fenetre', materiau: 'alu', typeOuverture: 'francaise',
  nbVantaux: 2, sens: 'droite', largeurRetenue: 1198, hauteurRetenue: 1349, referenceMesure: 'dormant_existant',
  pointDeVueMesure: 'interieur', typePose: 'renovation', poseConfirmee: true, poseConfirmeeLe: '2026-11-26T10:00:00Z',
  etatDormant: 'bon', alt: { largeur: null, hauteur: null }, colorisInt: 'Blanc', colorisExt: 'RAL 7016', vitrage: '',
  observations: 'RAS', statut: 'a_verifier', pointsAVerifier: ['Coloris à définir.', 'Écart'], version: 2, modifieLe: '2026-11-26T11:00:00Z',
};

test('ligne ProDevis : une ligne par ouvrage, colonnes dans l’ordre de la configuration', () => {
  const { entetes, lignes } = lignesExport(COLONNES_PRODEVIS, dossier, [ouvrage], { o1: { nbPhotos: 3 } });
  assert.equal(entetes.length, COLONNES_PRODEVIS.length);
  assert.equal(entetes[0], 'Réf. dossier');
  const v = Object.fromEntries(entetes.map((e, i) => [e, lignes[0][i]]));
  assert.equal(v['Repère'], 'F1');
  assert.equal(v['Largeur retenue (mm)'], 1198);
  assert.equal(v['Sens (paumelles, vu de l’intérieur)'], 'Droite');
  assert.equal(v['Pose confirmée client'], 'Oui (26/11/2026)');
  assert.equal(v['Statut relevé'], 'À VÉRIFIER');
  assert.equal(v['Points à vérifier'], 'Coloris à définir. | Écart');
  assert.equal(v['Nb photos'], 3);
  assert.equal(v['Date relevé'], '26/11/2026');
  const csv = versCsv(entetes, lignes);
  assert.ok(csv.includes(`"'=HYPERLINK(""http://x"")"`), 'formule neutralisée dans le CSV');
});

test('ouvrage fixe : sens « Sans objet »', () => {
  const { entetes, lignes } = lignesExport(COLONNES_PRODEVIS, dossier, [{ ...ouvrage, typeOuverture: 'fixe', sens: '' }]);
  assert.equal(lignes[0][entetes.indexOf('Sens (paumelles, vu de l’intérieur)')], 'Sans objet');
});

test('nom de fichier horodaté avec la référence', () => {
  assert.equal(nomFichier(dossier, 'export-prodevis', 'csv', new Date(2026, 10, 26, 9, 5)), 'LDM-261126-001_export-prodevis_20261126-0905.csv');
});
