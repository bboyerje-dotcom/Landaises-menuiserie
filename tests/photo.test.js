import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dimensionsCible, empreinteContenu, manquesPhotos, verifierFichier, PHOTO } from '../js/domain/photo.js';

test('réduction : côté le plus long ramené au maximum, proportions conservées', () => {
  assert.deepEqual(dimensionsCible(4000, 3000, 1600), { largeur: 1600, hauteur: 1200 });
  assert.deepEqual(dimensionsCible(3000, 4000, 1600), { largeur: 1200, hauteur: 1600 });
  assert.deepEqual(dimensionsCible(800, 600, 1600), { largeur: 800, hauteur: 600 }, 'pas d’agrandissement');
  assert.deepEqual(dimensionsCible(10000, 5, 320), { largeur: 320, hauteur: 1 }, 'jamais 0 px');
  assert.throws(() => dimensionsCible(0, 10, 100));
});

test('empreinte du contenu : même contenu → même empreinte, 1 octet de différence → différente', () => {
  const a = new Uint8Array(5000).map((_, i) => i % 251);
  const b = a.slice();
  assert.equal(empreinteContenu(a), empreinteContenu(b));
  b[2500] ^= 1;
  assert.notEqual(empreinteContenu(a), empreinteContenu(b));
  assert.match(empreinteContenu(a), /^5000-[0-9a-f]{8}$/);
});

test('photos obligatoires manquantes', () => {
  assert.equal(manquesPhotos(['exterieur', 'interieur']).length, 0);
  assert.equal(manquesPhotos(['technique']).length, 2);
});

test('vérification du fichier', () => {
  assert.match(verifierFichier({ type: 'application/pdf', size: 10 }), /pas une image/);
  assert.match(verifierFichier({ type: 'image/jpeg', size: 0 }), /vide/);
  assert.match(verifierFichier({ type: 'image/jpeg', size: PHOTO.tailleMaxOrigineOctets + 1 }), /volumineux/);
  assert.equal(verifierFichier({ type: 'image/jpeg', size: 1000 }), null);
  assert.equal(verifierFichier({ type: '', size: 1000 }), null, 'type inconnu (certains Android) : décodage tenté');
});
