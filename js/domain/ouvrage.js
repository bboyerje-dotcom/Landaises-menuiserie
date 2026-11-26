// Règles métier d'un ouvrage (étape 2 : fenêtre et porte-fenêtre ; étape 3 : photos).
// Module pur, testé avec `node --test`.
import { manquesPhotos } from './photo.js';
import { lireMm } from './mesures.js';
import { normaliserLdm, analyserLdm } from '../catalogue/fiche-ldm.js';

export const TYPOLOGIES = { fenetre: 'Fenêtre', porte_fenetre: 'Porte-fenêtre' };
export const OUVERTURES = { francaise: 'À la française', oscillo_battant: 'Oscillo-battant', fixe: 'Fixe (non ouvrant)' };
export const NB_VANTAUX = { 1: '1 vantail', 2: '2 vantaux', 3: '3 vantaux', 4: '4 vantaux' };
export const MATERIAUX = { alu: 'Aluminium', pvc: 'PVC', a_definir: 'À définir' };
export const TYPES_POSE = {
  renovation: 'Rénovation sur dormant conservé',
  depose_totale: 'Dépose totale',
  applique: 'Applique',
  tunnel: 'Tunnel',
  feuillure: 'Feuillure',
};
export const POINTS_DE_VUE = { interieur: 'Intérieur', exterieur: 'Extérieur' };
export const REFERENCES_MESURE = {
  dormant_existant: 'Sur le dormant existant',
  tableau: 'En tableau (maçonnerie)',
  baie_brute: 'Baie brute (neuf)',
};
export const ETATS_DORMANT = { bon: 'Bon', moyen: 'Moyen', mauvais: 'Mauvais' };
// Le sens est TOUJOURS décrit vu de l'intérieur (convention unique de l'outil).
export const SENS = { gauche: 'Gauche', droite: 'Droite' };
export const STATUTS_OUVRAGE = { complet: 'COMPLET', a_verifier: 'À VÉRIFIER', valide_technique: 'VALIDÉ TECHNIQUEMENT' };

// Références de mesure cohérentes avec chaque type de pose.
const REF_COHERENTES = {
  renovation: ['dormant_existant'],
  depose_totale: ['tableau'],
  applique: ['tableau', 'baie_brute'],
  tunnel: ['tableau', 'baie_brute'],
  feuillure: ['tableau', 'baie_brute'],
};

const ligne = (v) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '');

export { lireMm };

export function normaliserOuvrage(s = {}) {
  const b = (v) => v === true || v === 'on' || v === 'true';
  return {
    id: s.id,
    dossierId: s.dossierId,
    repere: ligne(s.repere).toUpperCase(),
    localisation: ligne(s.localisation),
    niveau: ligne(s.niveau),
    typologie: ligne(s.typologie),
    typeOuverture: ligne(s.typeOuverture),
    nbVantaux: s.nbVantaux ? Number(s.nbVantaux) : null,
    materiau: ligne(s.materiau),
    typePose: ligne(s.typePose),
    poseConfirmee: b(s.poseConfirmee),
    hesitationPose: b(s.hesitationPose),
    pointDeVueMesure: ligne(s.pointDeVueMesure),
    referenceMesure: ligne(s.referenceMesure),
    largeurs: [s.L1, s.L2, s.L3].map(lireMm),
    hauteurs: [s.H1, s.H2, s.H3].map(lireMm),
    diagonales: [s.D1, s.D2].map(lireMm),
    etatDormant: ligne(s.etatDormant),
    alt: { largeur: lireMm(s.altL), hauteur: lireMm(s.altH) },
    sens: ligne(s.sens),
    colorisInt: ligne(s.colorisInt),
    colorisExt: ligne(s.colorisExt),
    vitrage: ligne(s.vitrage),
    observations: typeof s.observations === 'string' ? s.observations.trim() : '',
    quantite: Number(s.quantite) > 0 ? Math.floor(Number(s.quantite)) : 1,
  };
}

// Ouvrage normalisé complet : relevé + fiche LDM (dont les champs dépendent du relevé).
export function normaliserOuvrageComplet(s = {}) {
  const o = normaliserOuvrage(s);
  o.ldm = normaliserLdm(s, o);
  return o;
}

const presentes = (t) => t.filter((x) => x != null && !Number.isNaN(x));
const ecart = (t) => (t.length > 1 ? Math.max(...t) - Math.min(...t) : 0);
const aDefinir = (v) => /^(a|à) d[ée]finir$/i.test(v);

// Analyse complète. Ne modifie rien.
//  - erreurs   : empêchent l'enregistrement (saisie illisible ou dangereuse)
//  - manquants : enregistrable, mais statut À VÉRIFIER
//  - alertes   : enregistrable, mais statut À VÉRIFIER
// `photos` : catégories des photos déjà rattachées à l'ouvrage (ex. ['exterieur']).
export function analyserOuvrage(o, { regles, dossier = null, autres = [], photos = [] }) {
  const erreurs = {};
  const manquants = [];
  const alertes = [];
  const manque = (champ, msg) => manquants.push({ champ, msg });
  const alerte = (champ, msg) => alertes.push({ champ, msg });

  // --- Erreurs bloquantes
  if (!o.repere) erreurs.repere = 'Repère obligatoire (ex. F1).';
  else if (autres.some((x) => x.id !== o.id && x.repere === o.repere)) erreurs.repere = `Le repère ${o.repere} existe déjà dans ce dossier.`;
  if (!(o.typologie in TYPOLOGIES)) erreurs.typologie = 'Choisissez la typologie.';
  const cotes = { L1: o.largeurs[0], L2: o.largeurs[1], L3: o.largeurs[2], H1: o.hauteurs[0], H2: o.hauteurs[1], H3: o.hauteurs[2], D1: o.diagonales[0], D2: o.diagonales[1], altL: o.alt.largeur, altH: o.alt.hauteur };
  for (const [k, v] of Object.entries(cotes)) {
    if (v == null) continue;
    if (Number.isNaN(v)) erreurs[k] = 'Nombre entier en millimètres, sans virgule (ex. 1250).';
    else if (v < regles.coteMinMm || v > regles.coteMaxMm) erreurs[k] = `Valeur hors plage ${regles.coteMinMm}–${regles.coteMaxMm} mm : vérifiez l’unité (mm).`;
  }

  // --- Champs manquants
  if (!o.localisation) manque('localisation', 'Localisation (pièce) non renseignée.');
  if (!(o.typeOuverture in OUVERTURES)) manque('typeOuverture', 'Type d’ouverture non renseigné.');
  if (!(String(o.nbVantaux) in NB_VANTAUX)) manque('nbVantaux', 'Nombre de vantaux non renseigné.');
  if (!(o.materiau in MATERIAUX)) manque('materiau', 'Matériau non renseigné.');
  if (!(o.typePose in TYPES_POSE)) manque('typePose', 'Type de pose non renseigné.');
  else if (!o.poseConfirmee) manque('poseConfirmee', 'Type de pose non confirmé par le client.');
  if (!(o.pointDeVueMesure in POINTS_DE_VUE)) manque('pointDeVueMesure', 'Point de vue de la mesure (intérieur/extérieur) non précisé.');
  if (!(o.referenceMesure in REFERENCES_MESURE)) manque('referenceMesure', 'Référence de mesure non précisée.');
  const L = presentes(o.largeurs);
  const H = presentes(o.hauteurs);
  if (L.length < regles.nbMesuresParDimension) manque('L1', `${L.length}/${regles.nbMesuresParDimension} largeurs mesurées.`);
  if (H.length < regles.nbMesuresParDimension) manque('H1', `${H.length}/${regles.nbMesuresParDimension} hauteurs mesurées.`);
  if (o.typeOuverture !== 'fixe' && !(o.sens in SENS)) manque('sens', 'Sens d’ouverture non renseigné.');
  if (!o.colorisInt) manque('colorisInt', 'Coloris intérieur non renseigné.');
  if (!o.colorisExt) manque('colorisExt', 'Coloris extérieur non renseigné.');
  if (o.typePose === 'renovation' && !(o.etatDormant in ETATS_DORMANT)) manque('etatDormant', 'État du dormant existant non renseigné.');
  if (o.hesitationPose && (o.alt.largeur == null || o.alt.hauteur == null)) manque('altL', 'Client hésitant : cotes du scénario alternatif (tableau) manquantes.');
  manquants.push(...manquesPhotos(photos));

  // --- Alertes de cohérence
  if (o.materiau === 'a_definir') alerte('materiau', 'Matériau à définir.');
  if (aDefinir(o.colorisInt) || aDefinir(o.colorisExt)) alerte('colorisInt', 'Coloris à définir.');
  if (ecart(L) > regles.ecartMaxEntreMesuresMm) alerte('L1', `Écart de ${ecart(L)} mm entre les largeurs (seuil ${regles.ecartMaxEntreMesuresMm} mm).`);
  if (ecart(H) > regles.ecartMaxEntreMesuresMm) alerte('H1', `Écart de ${ecart(H)} mm entre les hauteurs (seuil ${regles.ecartMaxEntreMesuresMm} mm).`);
  const D = presentes(o.diagonales);
  if (D.length === 2 && ecart(D) > regles.ecartMaxDiagonalesMm) alerte('D1', `Écart de ${ecart(D)} mm entre diagonales : baie hors d’équerre ?`);
  const lr = L.length ? Math.min(...L) : null;
  const hr = H.length ? Math.min(...H) : null;
  if (o.typologie === 'porte_fenetre' && lr && hr && lr > hr) alerte('L1', 'Porte-fenêtre plus large que haute : largeur et hauteur inversées ?');
  if (o.typePose in REF_COHERENTES && o.referenceMesure in REFERENCES_MESURE && !REF_COHERENTES[o.typePose].includes(o.referenceMesure))
    alerte('referenceMesure', `Mesure « ${REFERENCES_MESURE[o.referenceMesure]} » incohérente avec une pose « ${TYPES_POSE[o.typePose]} ».`);
  if (dossier?.typeChantier === 'neuf' && (o.typePose === 'renovation' || o.typePose === 'depose_totale'))
    alerte('typePose', 'Chantier neuf avec une pose de rénovation/dépose : à confirmer.');
  if (o.typePose === 'renovation' && o.etatDormant === 'mauvais') alerte('etatDormant', 'Dormant en mauvais état : la rénovation sur dormant conservé est-elle possible ?');
  if (o.typeOuverture === 'fixe' && o.sens) alerte('sens', 'Sens d’ouverture saisi sur un ouvrage fixe.');

  // Fiche LDM (si présente)
  if (o.ldm) {
    const l = analyserLdm(o);
    Object.assign(erreurs, l.erreurs);
    manquants.push(...l.manquants);
  }

  const valideEnregistrement = Object.keys(erreurs).length === 0;
  const statut = manquants.length === 0 && alertes.length === 0 ? 'complet' : 'a_verifier';
  return { valideEnregistrement, erreurs, manquants, alertes, statut, largeurRetenue: lr, hauteurRetenue: hr };
}

// Prochain repère libre : F1, F2… (fenêtres) / PF1, PF2… (portes-fenêtres)
export function prochainRepere(typologie, autres) {
  const p = typologie === 'porte_fenetre' ? 'PF' : 'F';
  const pris = new Set(autres.map((x) => x.repere));
  let n = 1;
  while (pris.has(p + n)) n++;
  return p + n;
}

// Tri naturel des repères (F2 avant F10).
export const trierParRepere = (a, b) => a.repere.localeCompare(b.repere, 'fr', { numeric: true });
