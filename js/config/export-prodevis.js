// Colonnes de l'export « ProDevis » (une ligne par ouvrage).
// ⚠ ORDRE PROVISOIRE : construit sans copie d'écran de ProDevis.
// Pour l'aligner sur votre écran de saisie, réordonnez simplement les lignes ci-dessous
// (ou renommez les en-têtes). Aucune autre modification n'est nécessaire.
import { produit } from '../catalogue/produits.js';
import {
  TYPOLOGIES, OUVERTURES, MATERIAUX, TYPES_POSE, POINTS_DE_VUE, REFERENCES_MESURE, ETATS_DORMANT, SENS, STATUTS_OUVRAGE,
} from '../domain/ouvrage.js';

const lib = (dico, v) => dico[v] || '';
const nomProduit = (o) => TYPOLOGIES[o.typologie] || produit(o.typologie)?.libelle || o.typologie || '';
const date = (iso) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '');

export const COLONNES_PRODEVIS = [
  { entete: 'Réf. dossier', valeur: (o, d) => d.reference },
  { entete: 'Client', valeur: (o, d) => d.clientNom },
  { entete: 'Commune chantier', valeur: (o, d) => d.commune },
  { entete: 'Repère', valeur: (o) => o.repere },
  { entete: 'Localisation', valeur: (o) => o.localisation },
  { entete: 'Niveau', valeur: (o) => o.niveau },
  { entete: 'Typologie', valeur: (o) => nomProduit(o) },
  { entete: 'Quantité', valeur: (o) => o.quantite || 1 },
  { entete: 'Matériau', valeur: (o) => lib(MATERIAUX, o.materiau) || (o.options?.materiau ? lib(MATERIAUX, o.options.materiau) || o.options.materiau : '') },
  { entete: 'Type d’ouverture', valeur: (o) => lib(OUVERTURES, o.typeOuverture) },
  { entete: 'Nb vantaux', valeur: (o) => o.nbVantaux ?? '' },
  { entete: 'Sens (paumelles, vu de l’intérieur)', valeur: (o) => (o.typeOuverture === 'fixe' ? 'Sans objet' : lib(SENS, o.sens)) },
  { entete: 'Largeur retenue (mm)', valeur: (o) => o.largeurRetenue ?? '' },
  { entete: 'Hauteur retenue (mm)', valeur: (o) => o.hauteurRetenue ?? '' },
  { entete: 'Autres cotes', valeur: (o) => {
    const p = produit(o.produit);
    if (!p || o.kind !== 'catalogue') return '';
    return p.cotes.filter((c) => c.groupe !== 'L' && c.groupe !== 'H' && o.cotes?.[c.id] != null)
      .map((c) => `${c.code} ${c.libelle} = ${o.cotes[c.id]}${c.unite === 'deg' ? '°' : ' mm'}`).join(' | ');
  } },
  { entete: 'Options produit', valeur: (o) => {
    const p = produit(o.produit);
    if (!p || o.kind !== 'catalogue') return '';
    return (p.options || []).filter((op) => o.options?.[op.id]).map((op) => `${op.libelle} : ${op.choix[o.options[op.id]] || o.options[op.id]}`).join(' | ');
  } },
  { entete: 'Mesures prises', valeur: (o) => lib(REFERENCES_MESURE, o.referenceMesure) },
  { entete: 'Mesures depuis', valeur: (o) => lib(POINTS_DE_VUE, o.pointDeVueMesure) },
  { entete: 'Type de pose', valeur: (o) => lib(TYPES_POSE, o.typePose) || produit(o.produit)?.poses?.[o.typePose] || '' },
  { entete: 'Pose confirmée client', valeur: (o) => (o.poseConfirmee ? `Oui (${date(o.poseConfirmeeLe)})` : 'Non') },
  { entete: 'État dormant', valeur: (o) => lib(ETATS_DORMANT, o.etatDormant) },
  { entete: 'Largeur tableau alt. (mm)', valeur: (o) => o.alt?.largeur ?? '' },
  { entete: 'Hauteur tableau alt. (mm)', valeur: (o) => o.alt?.hauteur ?? '' },
  { entete: 'Coloris intérieur', valeur: (o) => o.colorisInt },
  { entete: 'Coloris extérieur', valeur: (o) => o.colorisExt },
  { entete: 'Vitrage', valeur: (o) => o.vitrage },
  { entete: 'Observations', valeur: (o) => o.observations },
  { entete: 'Statut relevé', valeur: (o) => lib(STATUTS_OUVRAGE, o.statut) },
  { entete: 'Points à vérifier', valeur: (o) => (o.pointsAVerifier || []).join(' | ') },
  { entete: 'Nb photos', valeur: (o, d, x) => x.nbPhotos ?? 0 },
  { entete: 'Version relevé', valeur: (o) => o.version },
  { entete: 'Date relevé', valeur: (o) => date(o.modifieLe) },
];
