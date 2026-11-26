// Seuils de contrôle du relevé.
// ⚠ VALEURS PROVISOIRES DE DÉMONSTRATION. Elles ne viennent d'aucune norme ni d'aucun fabricant.
// Elles doivent être fixées par le responsable technique, puis `valide` passé à true.
// Tant que `valide` est false, l'application affiche un avertissement sur chaque relevé.
export const REGLES = {
  valide: false,
  validePar: '',
  valideLe: '',
  nbMesuresParDimension: 3, // nombre de largeurs et de hauteurs attendues
  retenue: 'min', // cote retenue = la plus petite des mesures
  ecartMaxEntreMesuresMm: 10, // au-delà : À VÉRIFIER (hors d'équerre, faux aplomb, erreur de lecture)
  ecartMaxDiagonalesMm: 10,
  coteMinMm: 200, // en dessous : probable erreur de saisie (ex. cm au lieu de mm)
  coteMaxMm: 6000,
};
