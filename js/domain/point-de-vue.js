// Point de vue choisi au cas par cas (intérieur ou extérieur) et conversion vers l'autre côté.
// Module pur, testé avec `node --test`.
export const VUES = { interieur: 'Intérieur', exterieur: 'Extérieur' };
export const INVERSE_GD = { gauche: 'droite', droite: 'gauche' };

export const autreVue = (v) => (v === 'interieur' ? 'exterieur' : v === 'exterieur' ? 'interieur' : '');
export const vuDe = (v) => (v === 'exterieur' ? 'vu de l’extérieur' : v === 'interieur' ? 'vu de l’intérieur' : 'point de vue non précisé');

// Valeur équivalente vue de l'autre côté (ex. paumelles à gauche vu de l'extérieur = à droite vu de l'intérieur).
export function equivalent(valeur, inverse, vue) {
  if (!valeur || !inverse?.[valeur] || !VUES[vue]) return null;
  return { valeur: inverse[valeur], vue: autreVue(vue) };
}

// Texte complet : « Gauche (vu de l’extérieur) — soit Droite vu de l’intérieur ».
export function texteAvecVue(valeur, choix, inverse, vue) {
  if (!valeur) return '';
  const base = `${choix[valeur] || valeur} (${vuDe(vue)})`;
  const eq = equivalent(valeur, inverse, vue);
  return eq ? `${base} — soit ${(choix[eq.valeur] || eq.valeur).toLowerCase()} ${vuDe(eq.vue)}` : base;
}

// Valeur ramenée à une convention donnée (ex. tout exprimer vu de l'intérieur pour l'export).
export function versVue(valeur, inverse, vue, cible) {
  if (!valeur || !VUES[vue]) return '';
  if (vue === cible) return valeur;
  return inverse?.[valeur] || '';
}
