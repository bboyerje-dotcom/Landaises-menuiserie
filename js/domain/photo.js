// Règles métier des photos d'un ouvrage. Module pur, testé avec `node --test`.

export const CATEGORIES_PHOTO = {
  exterieur: 'Vue extérieure',
  interieur: 'Vue intérieure',
  support: 'Support / dormant / maçonnerie',
  technique: 'Point technique (appui, seuil, coffre, électricité…)',
};
export const PHOTOS_OBLIGATOIRES = ['exterieur', 'interieur'];

export const PHOTO = {
  coteMaxPx: 1600, // côté le plus long après compression
  miniaturePx: 320,
  qualiteJpeg: 0.8,
  tailleMaxOrigineOctets: 40 * 1024 * 1024, // au-delà : fichier refusé (pas une photo de chantier)
};

// Dimensions après réduction, proportions conservées, jamais d'agrandissement.
export function dimensionsCible(largeur, hauteur, max) {
  if (!(largeur > 0 && hauteur > 0)) throw new Error('Dimensions d’image invalides.');
  const r = Math.min(1, max / Math.max(largeur, hauteur));
  return { largeur: Math.max(1, Math.round(largeur * r)), hauteur: Math.max(1, Math.round(hauteur * r)) };
}

// Empreinte du CONTENU (FNV-1a 32 bits + taille) : détecte la même photo ajoutée deux fois,
// quel que soit son nom. Non cryptographique (crypto.subtle absent en http sur réseau local),
// suffisant pour repérer un doublon sur un même ouvrage.
export function empreinteContenu(octets) {
  let h = 0x811c9dc5;
  for (let i = 0; i < octets.length; i++) {
    h ^= octets[i];
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `${octets.length}-${h.toString(16).padStart(8, '0')}`;
}

export function manquesPhotos(categoriesPresentes = []) {
  return PHOTOS_OBLIGATOIRES
    .filter((c) => !categoriesPresentes.includes(c))
    .map((c) => ({ champ: 'photos', msg: `Photo « ${CATEGORIES_PHOTO[c]} » manquante.` }));
}

export function verifierFichier(f) {
  if (!f) return 'Aucun fichier.';
  if (f.type && !f.type.startsWith('image/')) return 'Ce fichier n’est pas une image.';
  if (f.size === 0) return 'Fichier vide.';
  if (f.size > PHOTO.tailleMaxOrigineOctets) return 'Fichier trop volumineux (plus de 40 Mo).';
  return null;
}
