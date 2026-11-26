import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normaliserDossier, validerDossier, genererReference, prefixeReference,
  prochaineSequence, detecterDoublons, normaliserTelephone, nouvelId,
} from '../js/domain/dossier.js';

const complet = () => normaliserDossier({
  id: 'a', clientNom: '  Dupont   Jean ', telephone: '06 12 34 56 78', email: '',
  adresse: '12 rue des Pins', codePostal: '40 000', commune: 'Mont-de-Marsan',
  responsable: 'B. Test', dateRdv: '2026-11-26', typeChantier: 'renovation', natureBatiment: 'maison',
  description: ' Remplacement fenêtres\nséjour ',
});

test('un dossier complet est valide et normalisé', () => {
  const d = complet();
  assert.equal(d.clientNom, 'Dupont Jean');
  assert.equal(d.codePostal, '40000');
  assert.equal(d.telephone, '0612345678');
  assert.equal(d.description, 'Remplacement fenêtres\nséjour');
  assert.deepEqual(validerDossier(d), { valide: true, erreurs: {} });
});

test('un dossier vide liste tous les champs obligatoires', () => {
  const { valide, erreurs } = validerDossier(normaliserDossier({}));
  assert.equal(valide, false);
  assert.deepEqual(Object.keys(erreurs).sort(), [
    'adresse', 'clientNom', 'codePostal', 'commune', 'dateRdv', 'natureBatiment', 'responsable', 'telephone', 'typeChantier',
  ].sort());
});

test('champs espaces seuls = vides', () => {
  const d = normaliserDossier({ ...complet(), clientNom: '    ', commune: ' ' });
  const { erreurs } = validerDossier(d);
  assert.ok(erreurs.clientNom && erreurs.commune);
});

test('téléphone : formats français acceptés, invalides refusés', () => {
  assert.equal(normaliserTelephone('+33 6 12 34 56 78'), '0612345678');
  assert.equal(normaliserTelephone('0033612345678'), '0612345678');
  assert.equal(normaliserTelephone('06.12.34.56.78'), '0612345678');
  for (const t of ['0612', '1612345678', '06123456789', 'abc']) {
    assert.ok(validerDossier({ ...complet(), telephone: normaliserTelephone(t) }).erreurs.telephone, t);
  }
});

test('email facultatif mais vérifié si saisi', () => {
  assert.ok(validerDossier({ ...complet(), email: 'pas-un-mail' }).erreurs.email);
  assert.equal(validerDossier({ ...complet(), email: 'a@b.fr' }).valide, true);
});

test('date impossible refusée', () => {
  assert.ok(validerDossier({ ...complet(), dateRdv: '2026-02-30' }).erreurs.dateRdv);
  assert.ok(validerDossier({ ...complet(), dateRdv: '26/11/2026' }).erreurs.dateRdv);
});

test('valeurs de liste hors référentiel refusées', () => {
  const { erreurs } = validerDossier({ ...complet(), typeChantier: 'autre', natureBatiment: 'chateau' });
  assert.ok(erreurs.typeChantier && erreurs.natureBatiment);
});

test('référence LDM-AAMMJJ-NNN et séquence du jour', () => {
  assert.equal(prefixeReference('2026-11-26'), 'LDM-261126-');
  assert.equal(genererReference('2026-11-26', 7), 'LDM-261126-007');
  assert.equal(prochaineSequence('LDM-261126-', []), 1);
  assert.equal(prochaineSequence('LDM-261126-', ['LDM-261126-001', 'LDM-261126-004', 'LDM-261125-009']), 5);
});

test('doublons : même téléphone ou même adresse (accents/casse ignorés), pas soi-même', () => {
  const a = complet();
  const b = { ...complet(), id: 'b', telephone: '0700000000', adresse: '12 RUE DES PINS' };
  const c = { ...complet(), id: 'c', telephone: '0612345678', adresse: 'autre', codePostal: '40100' };
  const e = { ...complet(), id: 'e', telephone: '0711111111', adresse: 'ailleurs' };
  const r = detecterDoublons(a, [a, b, c, e]);
  assert.deepEqual(r.map((x) => x.dossier.id), ['b', 'c']);
  assert.deepEqual(r[0].motifs, ['même adresse de chantier']);
  assert.deepEqual(r[1].motifs, ['même téléphone']);
});

test('identifiant unique même sans crypto.randomUUID (http en réseau local)', () => {
  const sansUuid = { getRandomValues: (b) => globalThis.crypto.getRandomValues(b) };
  const ids = new Set(Array.from({ length: 500 }, () => nouvelId(sansUuid)));
  assert.equal(ids.size, 500);
  assert.match([...ids][0], /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});
