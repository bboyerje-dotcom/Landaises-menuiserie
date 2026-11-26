// Règles du relevé pour les produits du catalogue (hors formulaire détaillé fenêtre).
// Module pur, testé avec `node --test`.
import { lireMm } from './mesures.js';
import { CATEGORIES_PHOTO } from './photo.js';

const ligne = (v) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '');

// Angle (°) à partir d'un dénivelé et d'une longueur horizontale, mêmes unités.
export function penteDegres(denivele, longueur) {
  if (!(longueur > 0) || !(denivele >= 0)) return null;
  return Math.round((Math.atan(denivele / longueur) * 180) / Math.PI * 10) / 10;
}
export const pentePourcent = (deg) => (deg == null ? null : Math.round(Math.tan((deg * Math.PI) / 180) * 1000) / 10);

// Degrés : décimale acceptée (virgule ou point). '' → null ; illisible → NaN.
export function lireDegres(v) {
  const s = String(v ?? '').replace(/\s/g, '').replace(',', '.');
  if (s === '') return null;
  return /^\d+(\.\d+)?$/.test(s) ? Number(s) : NaN;
}

export function optionVisible(opt, options) {
  if (!opt.siOption) return true;
  return Object.entries(opt.siOption).every(([k, vals]) => vals.includes(options[k]));
}

export function normaliserOuvrageCatalogue(s, produit) {
  const cotes = {};
  for (const c of produit.cotes) cotes[c.id] = c.unite === 'deg' || c.decimal ? lireDegres(s['cote_' + c.id]) : lireMm(s['cote_' + c.id]);
  const options = {};
  for (const o of produit.options || []) options[o.id] = ligne(s['opt_' + o.id]);
  for (const o of produit.options || []) if (!optionVisible(o, options)) options[o.id] = '';
  return {
    id: s.id, dossierId: s.dossierId, kind: 'catalogue', produit: produit.id, typologie: produit.id,
    repere: ligne(s.repere).toUpperCase(), localisation: ligne(s.localisation), niveau: ligne(s.niveau),
    quantite: Number(s.quantite) > 0 ? Math.floor(Number(s.quantite)) : 1,
    pointDeVueMesure: ligne(s.pointDeVueMesure), typePose: ligne(s.typePose), poseConfirmee: s.poseConfirmee === true || s.poseConfirmee === 'on',
    cotes, options, observations: typeof s.observations === 'string' ? s.observations.trim() : '',
  };
}

const ok = (v) => v != null && !Number.isNaN(v);

export function analyserOuvrageCatalogue(o, produit, { regles, autres = [], photos = [] }) {
  const erreurs = {}, manquants = [], alertes = [];
  const manque = (champ, msg) => manquants.push({ champ, msg });
  const alerte = (champ, msg) => alertes.push({ champ, msg });

  if (!o.repere) erreurs.repere = 'Repère obligatoire.';
  else if (autres.some((x) => x.id !== o.id && x.repere === o.repere)) erreurs.repere = `Le repère ${o.repere} existe déjà dans ce dossier.`;

  for (const c of produit.cotes) {
    const v = o.cotes[c.id];
    const champ = 'cote_' + c.id;
    if (v == null) { if (c.obligatoire) manque(champ, `${c.code} – ${c.libelle} : non mesuré.`); continue; }
    if (Number.isNaN(v)) { erreurs[champ] = c.unite === 'deg' ? 'Angle en degrés (ex. 12 ou 12,5).' : c.decimal ? 'Nombre en millimètres (ex. 24 ou 28,8).' : 'Nombre entier en millimètres, sans virgule (ex. 1250).'; continue; }
    if (c.unite === 'deg') { if (v > 60) erreurs[champ] = 'Angle supérieur à 60° : vérifiez la saisie.'; continue; }
    const principal = c.type === 'largeur' || c.type === 'hauteur';
    const min = c.min ?? (principal ? regles.coteMinMm : 1);
    const max = c.max ?? (produit.coteMaxMm || (principal ? regles.coteMaxMm : 20000));
    if (v < min || v > max) erreurs[champ] = `Valeur hors plage ${min}–${max} mm : vérifiez l’unité (mm).`;
  }

  if (!o.localisation) manque('localisation', 'Localisation non renseignée.');
  if (!['interieur', 'exterieur'].includes(o.pointDeVueMesure)) manque('pointDeVueMesure', 'Point de vue des mesures (intérieur / extérieur) non précisé.');
  if (produit.poses) {
    if (!(o.typePose in produit.poses)) manque('typePose', 'Type de pose non renseigné.');
    else if (!o.poseConfirmee) manque('poseConfirmee', 'Type de pose non confirmé par le client.');
    if (o.typePose === 'a_definir') alerte('typePose', 'Type de pose à définir.');
  }
  for (const op of produit.options || []) {
    if (!optionVisible(op, o.options)) continue;
    const v = o.options[op.id];
    if (!v) { if (op.obligatoire) manque('opt_' + op.id, `${op.libelle} : non renseigné.`); }
    else if (v === 'a_definir' || v === 'a_verifier') alerte('opt_' + op.id, `${op.libelle} : ${op.choix[v].toLowerCase()}.`);
  }
  // Calcul propre au produit (ex. abaque de remplacement de casse)
  let calcul = null;
  if (produit.calcul) {
    calcul = produit.calcul(o);
    manquants.push(...calcul.manquants);
    alertes.push(...calcul.alertes);
  }
  for (const cat of produit.photos || ['exterieur']) if (!photos.includes(cat)) manque('photos', `Photo « ${CATEGORIES_PHOTO[cat]} » manquante.`);

  // Écarts entre mesures d'une même dimension
  const groupe = (g) => produit.cotes.filter((c) => c.groupe === g).map((c) => o.cotes[c.id]).filter(ok);
  const L = groupe('L'), H = groupe('H');
  const ecart = (t) => (t.length > 1 ? Math.max(...t) - Math.min(...t) : 0);
  if (ecart(L) > regles.ecartMaxEntreMesuresMm) alerte('cote_L1', `Écart de ${ecart(L)} mm entre les largeurs (seuil ${regles.ecartMaxEntreMesuresMm} mm).`);
  if (ecart(H) > regles.ecartMaxEntreMesuresMm) alerte('cote_H1', `Écart de ${ecart(H)} mm entre les hauteurs (seuil ${regles.ecartMaxEntreMesuresMm} mm).`);
  const lr = L.length ? Math.min(...L) : null;
  const hr = H.length ? Math.min(...H) : null;
  if (produit.formeAttendue === 'haute' && lr && hr && lr > hr) alerte('cote_L1', `${produit.libelle} plus large que haute : largeur et hauteur inversées ?`);
  const d = [o.cotes.D1, o.cotes.D2].filter(ok);
  if (d.length === 2 && ecart(d) > regles.ecartMaxDiagonalesMm) alerte('cote_D1', `Écart de ${ecart(d)} mm entre diagonales : baie hors d’équerre ?`);

  return {
    valideEnregistrement: Object.keys(erreurs).length === 0, erreurs, manquants, alertes,
    statut: manquants.length === 0 && alertes.length === 0 ? 'complet' : 'a_verifier',
    largeurRetenue: lr, hauteurRetenue: hr,
    calcul: calcul ? { lignes: calcul.lignes, nette: calcul.nette } : null,
  };
}
