// Code couleur des cotes : identique sur les illustrations, le tableau de métrage, la photo et le PDF.
// La couleur n'est jamais seule : chaque cote porte aussi un code texte (L1, H2, RH…).
export const TYPES_COTE = {
  largeur:      { libelle: 'Largeur',            couleur: '#1565c0', unite: 'mm' }, // bleu
  hauteur:      { libelle: 'Hauteur',            couleur: '#c62828', unite: 'mm' }, // rouge
  retour:       { libelle: 'Retour d’habillage', couleur: '#2e7d32', unite: 'mm' }, // vert
  tapee:        { libelle: 'Tapée / doublage',   couleur: '#6a1b9a', unite: 'mm' }, // violet
  recouvrement: { libelle: 'Recouvrement',       couleur: '#e65100', unite: 'mm' }, // orange
  profondeur:   { libelle: 'Profondeur / avancée', couleur: '#00838f', unite: 'mm' }, // bleu-vert
  pente:        { libelle: 'Pente',              couleur: '#ad1457', unite: '°' },  // framboise
  autre:        { libelle: 'Autre cote (retombée, écoinçon…)', couleur: '#5d4037', unite: 'mm' }, // brun
};

export const couleurCote = (type) => (TYPES_COTE[type] || TYPES_COTE.autre).couleur;
