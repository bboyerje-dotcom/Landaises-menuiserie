// Fiche de relevé LDM (version papier 13 du 23/03/21) reprise pour fenêtre et porte-fenêtre.
// Chaque champ : type 'radio' | 'cases' (plusieurs choix) | 'case' (oui/non) | 'texte' | 'mm'.
// `si(o)` : le champ ne s'affiche (et n'est enregistré) que si la condition est vraie.
// `obligatoire(o)` : absent → statut À VÉRIFIER.
import { lireMm } from '../domain/mesures.js';

const ouvrant = (o) => o.typeOuverture && o.typeOuverture !== 'fixe';
const GDHB = { G: 'Gauche', D: 'Droite', H: 'Haut', B: 'Bas' };

export const CHAMPS_LDM = [
  { id: 'provenance', libelle: 'Provenance du devis', type: 'radio', choix: { techdesign: 'TechDesign', prodevis: 'ProDevis' } },
  { id: 'gamme', libelle: 'Gamme', type: 'radio', choix: { g55: '55', g65: '65', autre: 'Autre / à préciser' }, obligatoire: (o) => o.materiau === 'alu' },
  {
    id: 'natureCotes', libelle: 'Nature des cotes transmises', type: 'radio', obligatoire: () => true,
    choix: { dp: 'DP (L entre tapées, H sous tapée / sous bavette mono)', nettes: 'Nettes à fabriquer (dos de dormant)', appro: 'Appro' },
    aide: 'Des cotes « nettes à fabriquer » exigent une validation technique avant commande.',
  },
  { id: 'appui', libelle: 'Appui de fenêtre', type: 'radio', choix: { rentrant: 'Rentrant', affleurant: 'Affleurant' }, si: (o) => o.typologie === 'fenetre', obligatoire: (o) => o.typologie === 'fenetre' },
  { id: 'allege', libelle: 'Hauteur d’allège (sol fini → bas de baie)', type: 'mm', si: (o) => o.typologie === 'fenetre' },
  { id: 'seuil', libelle: 'Seuil de porte (réf.)', type: 'texte', si: (o) => o.typologie === 'porte_fenetre' },
  { id: 'poignee', libelle: 'Poignée', type: 'radio', si: ouvrant, obligatoire: ouvrant,
    choix: { gy_standard: 'GY standard', gy_design: 'GY Design', bequille_simple: 'Béquille simple', bequille_double: 'Béquille double', marechal: 'Maréchal', autre: 'Autre' } },
  { id: 'poigneeRef', libelle: 'Réf. poignée', type: 'texte', si: (o) => ouvrant(o) && o.ldm.poignee === 'autre', obligatoire: (o) => ouvrant(o) && o.ldm.poignee === 'autre' },
  { id: 'hauteurPoignee', libelle: 'Hauteur de poignée', type: 'mm', si: ouvrant },
  { id: 'fermeture', libelle: 'Fermeture', type: 'radio', si: ouvrant, obligatoire: ouvrant, choix: { pt1: '1 point', pts3: '3 points', autre: 'Autre' } },
  { id: 'accessoires', libelle: 'Accessoires', type: 'cases',
    choix: { canon: 'Canon', molete: 'Moleté', cremone_pompier: 'Crémone pompier', ferme_porte: 'Ferme-porte avec arrêt', butoir: 'Butoir alu', rail_encastre: 'Rail encastré' } },
  { id: 'gea', libelle: 'Entrée d’air (GEA)', type: 'radio', choix: { aucune: 'Aucune', usinage: 'Usinage', grille: 'Grille (fixations non fournies)' } },
  { id: 'quincaillerieSpeciale', libelle: 'Quincaillerie spéciale', type: 'texte' },
  { id: 'nePasVitrer', libelle: 'Ne pas vitrer en atelier', type: 'case' },
  { id: 'epaisseurDoublage', libelle: 'Épaisseur de doublage (DP)', type: 'mm' },
  { id: 'habInt', libelle: 'Habillage intérieur (couvre-joint)', type: 'cases', choix: GDHB },
  { id: 'habIntRef', libelle: 'Réf. habillage intérieur', type: 'texte', si: (o) => o.ldm.habInt?.length > 0 },
  { id: 'habExt', libelle: 'Habillage extérieur', type: 'cases', choix: GDHB },
  { id: 'habExtRef', libelle: 'Réf. habillage extérieur', type: 'texte', si: (o) => o.ldm.habExt?.length > 0 },
  { id: 'bavette', libelle: 'Bavette', type: 'case' },
  { id: 'bavetteRef', libelle: 'Réf. bavette', type: 'texte', si: (o) => o.ldm.bavette === true },
  { id: 'voletRoulant', libelle: 'Passage / type de volet roulant', type: 'radio',
    choix: { aucun: 'Aucun', tradi_caisson_bois: 'Tradi caisson bois intérieur', tradi_tunnel_280: 'Tradi coffre tunnel 280 mm', tradi_tunnel_300: 'Tradi coffre tunnel 300 mm', bloc_caisson_int: 'Bloc caisson intérieur', bloc_demi_linteau: 'Bloc ½ linteau' } },
];

const nom = (c, code) => (code ? `ldm_${c.id}_${code}` : `ldm_${c.id}`);
const ligne = (v) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '');
const vrai = (v) => v === true || v === 'on' || v === 'true';

// Lit les champs « ldm_* » d'une saisie. `o` (ouvrage normalisé) sert aux conditions `si`.
export function normaliserLdm(s, o) {
  const ldm = {};
  for (const c of CHAMPS_LDM) {
    if (c.type === 'cases') ldm[c.id] = Object.keys(c.choix).filter((k) => vrai(s[nom(c, k)]));
    else if (c.type === 'case') ldm[c.id] = vrai(s[nom(c)]);
    else if (c.type === 'mm') ldm[c.id] = lireMm(s[nom(c)]);
    else ldm[c.id] = ligne(s[nom(c)]);
  }
  // Champs non applicables vidés (pas de valeur périmée enregistrée). Deux passes : un champ peut
  // dépendre d'un autre champ LDM (ex. réf. poignée si poignée « autre »).
  for (let passe = 0; passe < 2; passe++) {
    const ctx = { ...o, ldm };
    for (const c of CHAMPS_LDM) if (c.si && !c.si(ctx)) ldm[c.id] = c.type === 'cases' ? [] : c.type === 'case' ? false : c.type === 'mm' ? null : '';
  }
  return ldm;
}

export function analyserLdm(o) {
  const erreurs = {}, manquants = [];
  const ldm = o.ldm || {};
  for (const c of CHAMPS_LDM) {
    if (c.si && !c.si(o)) continue;
    const v = ldm[c.id];
    if (c.type === 'mm' && v != null) {
      if (Number.isNaN(v)) erreurs[nom(c)] = 'Nombre entier en millimètres, sans virgule.';
      else if (v > 5000) erreurs[nom(c)] = 'Valeur supérieure à 5000 mm : vérifiez l’unité.';
    }
    const vide = v == null || v === '' || (Array.isArray(v) && !v.length);
    if (c.obligatoire?.(o) && vide) manquants.push({ champ: nom(c), msg: `${c.libelle} : non renseigné.` });
  }
  return { erreurs, manquants };
}

// Lignes lisibles pour le PDF et l'export (champs renseignés uniquement).
export function resumeLdm(o) {
  const ldm = o.ldm || {};
  const res = [];
  for (const c of CHAMPS_LDM) {
    if (c.si && !c.si(o)) continue;
    const v = ldm[c.id];
    let t = '';
    if (c.type === 'cases') t = (v || []).map((k) => c.choix[k]).join(', ');
    else if (c.type === 'case') t = v ? 'Oui' : '';
    else if (c.type === 'mm') t = v != null && !Number.isNaN(v) ? `${v} mm` : '';
    else if (c.type === 'radio') t = c.choix[v] || '';
    else t = v || '';
    if (t) res.push([c.libelle, t]);
  }
  return res;
}

// Valeurs de formulaire depuis un ouvrage enregistré.
export function valeursFormLdm(o) {
  const v = {};
  for (const c of CHAMPS_LDM) {
    const x = o.ldm?.[c.id];
    if (c.type === 'cases') for (const k of Object.keys(c.choix)) v[nom(c, k)] = (x || []).includes(k);
    else if (c.type === 'case') v[nom(c)] = x === true;
    else v[nom(c)] = x ?? '';
  }
  return v;
}

export { nom as nomChampLdm };
