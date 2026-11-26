// Catalogue des produits à relever : illustration, cotes à prendre, options, types de pose.
// ⚠ VERSION 1 À VALIDER PAR LE RESPONSABLE TECHNIQUE. Les points de mesure décrits sont des
// pratiques de relevé courantes, pas des prescriptions fabricant : les jeux, réservations et
// cotes de fabrication restent à établir selon le système retenu.
//
// Repère des dessins : viewBox 300 × 220. Le « trait » d'une cote sert à la fois à
// l'illustration ET à sa position par défaut sur la photo (l'ouvrage est supposé occuper la photo ;
// l'utilisateur ajuste ensuite en faisant glisser les extrémités).

// ---------- Primitives de dessin
const R = (x, y, w, h, c = 'd-trait') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" class="${c}"/>`;
const L = (x1, y1, x2, y2, c = 'd-fin') => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${c}"/>`;
const P = (d, c = 'd-fin') => `<path d="${d}" class="${c}"/>`;
const T = (x, y, t, c = 'd-txt', ancre = 'middle') => `<text x="${x}" y="${y}" class="${c}" text-anchor="${ancre}">${t}</text>`;
const lames = (x, y, w, h, n) => Array.from({ length: n }, (_, i) => L(x, y + ((i + 1) * h) / (n + 1), x + w, y + ((i + 1) * h) / (n + 1))).join('');
const mur = (x, y, w, h) => R(x, y, w, h, 'd-mur');
const sol = (y = 212) => L(0, y, 300, y, 'd-sol');

// ---------- Fabriques de cotes
const cote = (id, code, libelle, type, trait, o = {}) => ({
  id, code, libelle, type, trait, obligatoire: true,
  groupe: type === 'largeur' ? 'L' : type === 'hauteur' ? 'H' : null, ...o,
});
// 3 largeurs (haut/milieu/bas) et 3 hauteurs (gauche/milieu/droite) dans le rectangle donné.
function lh3(x, y, w, h, quoi = 'tableau') {
  const yl = [y + h * 0.1, y + h * 0.5, y + h * 0.9];
  const xh = [x + w * 0.08, x + w * 0.5, x + w * 0.92];
  return [
    cote('L1', 'L1', `Largeur haut (${quoi})`, 'largeur', [x, yl[0], x + w, yl[0]]),
    cote('L2', 'L2', `Largeur milieu (${quoi})`, 'largeur', [x, yl[1], x + w, yl[1]]),
    cote('L3', 'L3', `Largeur bas (${quoi})`, 'largeur', [x, yl[2], x + w, yl[2]]),
    cote('H1', 'H1', `Hauteur gauche (${quoi})`, 'hauteur', [xh[0], y, xh[0], y + h]),
    cote('H2', 'H2', `Hauteur milieu (${quoi})`, 'hauteur', [xh[1], y, xh[1], y + h], { t: 0.3 }),
    cote('H3', 'H3', `Hauteur droite (${quoi})`, 'hauteur', [xh[2], y, xh[2], y + h]),
  ];
}
// 2 largeurs (haut/bas) et 2 hauteurs (gauche/droite).
function lh2(x, y, w, h, quoi = 'baie') {
  return [
    cote('L1', 'L1', `Largeur haut (${quoi})`, 'largeur', [x, y + h * 0.1, x + w, y + h * 0.1]),
    cote('L2', 'L2', `Largeur bas (${quoi})`, 'largeur', [x, y + h * 0.9, x + w, y + h * 0.9]),
    cote('H1', 'H1', `Hauteur gauche (${quoi})`, 'hauteur', [x + w * 0.08, y, x + w * 0.08, y + h]),
    cote('H2', 'H2', `Hauteur droite (${quoi})`, 'hauteur', [x + w * 0.92, y, x + w * 0.92, y + h]),
  ];
}
const diagonales = (x, y, w, h) => [
  cote('D1', 'D1', 'Diagonale 1', 'autre', [x, y, x + w, y + h], { obligatoire: false, t: 0.72 }),
  cote('D2', 'D2', 'Diagonale 2', 'autre', [x + w, y, x, y + h], { obligatoire: false, t: 0.72 }),
];
const facultatif = (c) => ({ ...c, obligatoire: false });

// ---------- Options réutilisables
const opt = (id, libelle, choix, o = {}) => ({ id, libelle, choix, obligatoire: true, ...o });
const MATERIAU_MENUISERIE = opt('materiau', 'Matériau', { alu: 'Aluminium', pvc: 'PVC', bois: 'Bois', mixte: 'Mixte', a_definir: 'À définir' });
const MANOEUVRE = opt('manoeuvre', 'Manœuvre', { sangle: 'Sangle', treuil: 'Treuil / manivelle', filaire: 'Moteur filaire', radio: 'Moteur radio', solaire: 'Solaire', a_definir: 'À définir' });
const COTE_MANOEUVRE_INT = opt('coteManoeuvre', 'Côté manœuvre / moteur (vu de l’INTÉRIEUR)', { gauche: 'Gauche', droite: 'Droite' });
const ALIM = opt('alimentation', 'Alimentation électrique à proximité', { oui: 'Oui', non: 'Non', a_verifier: 'À vérifier' }, { siOption: { manoeuvre: ['filaire', 'radio'] } });
const MOTORISATION = opt('motorisation', 'Motorisation', { non: 'Non', oui: 'Oui', a_definir: 'À définir' });
const ALIM_MOTEUR = opt('alimentation', 'Alimentation électrique à proximité', { oui: 'Oui', non: 'Non', a_verifier: 'À vérifier' }, { siOption: { motorisation: ['oui'] } });
const SUPPORT = opt('support', 'Nature du support de fixation', { beton: 'Béton', parpaing: 'Parpaing', brique: 'Brique', pierre: 'Pierre', bois: 'Bois / ossature', isolant: 'Isolation extérieure', a_verifier: 'À vérifier' });
import { SERIES_CASSE, VERRES, INTERCALAIRES } from '../config/abaque-casse.js';
import { calculCasse } from '../domain/casse.js';
const choixDe = (t) => Object.fromEntries(Object.entries(t).map(([k, v]) => [k, v.libelle]));

const POSES_MENUISERIE = { renovation: 'Rénovation sur dormant conservé', depose_totale: 'Dépose totale', applique: 'Applique', tunnel: 'Tunnel', feuillure: 'Feuillure' };

export const FAMILLES = {
  menuiserie: 'Fenêtres et portes',
  garage: 'Portes de garage',
  volet: 'Volets',
  store: 'Stores',
  exterieur: 'Portails, pergolas, carports',
  sav: 'SAV / vitrage',
};

// ---------- Dessins réutilisés
const dessinFenetre = (x, y, w, h, vantaux = 2) => {
  let s = R(x, y, w, h) + R(x + 6, y + 6, w - 12, h - 12, 'd-fin');
  const lv = (w - 12) / vantaux;
  for (let i = 0; i < vantaux; i++) {
    const a = x + 6 + i * lv;
    if (i) s += L(a, y + 6, a, y + h - 6, 'd-trait');
    // triangle d'ouverture : pointe côté paumelles
    const gauche = vantaux === 1 || i === 0;
    const xp = gauche ? a + 4 : a + lv - 4;
    const xo = gauche ? a + lv - 4 : a + 4;
    s += L(xo, y + 10, xp, y + h / 2, 'd-ouv') + L(xp, y + h / 2, xo, y + h - 10, 'd-ouv');
  }
  return s;
};
const dessinStoreCote = (coffre) => mur(28, 0, 12, 212) + sol()
  + (coffre ? R(40, 38, 26, 22, 'd-plein') : R(40, 44, 10, 10, 'd-plein'))
  + L(coffre ? 66 : 50, 50, 252, 96, 'd-toile') + L(252, 96, 252, 112, 'd-trait')
  + L(46, 80, 150, 74, 'd-fin') + L(150, 74, 250, 97, 'd-fin')
  + T(150, 205, 'Vue de côté', 'd-legende');

// ---------- Catalogue
export const PRODUITS = [
  // ===== Fenêtres et portes
  {
    id: 'fenetre', famille: 'menuiserie', libelle: 'Fenêtre', prefixe: 'F', formulaire: 'fenetre',
    aide: 'Formulaire détaillé fenêtre (pose, sens, état du dormant).',
    dessin: () => dessinFenetre(70, 25, 160, 170, 2),
    cotes: [...lh3(70, 25, 160, 170, 'tableau ou dormant'), ...diagonales(70, 25, 160, 170)],
  },
  {
    id: 'porte_fenetre', famille: 'menuiserie', libelle: 'Porte-fenêtre', prefixe: 'PF', formulaire: 'fenetre',
    aide: 'Formulaire détaillé fenêtre (pose, sens, état du dormant).',
    dessin: () => dessinFenetre(95, 8, 110, 204, 2) + sol(),
    cotes: [...lh3(95, 8, 110, 204, 'tableau ou dormant'), ...diagonales(95, 8, 110, 204)],
  },
  {
    id: 'baie_coulissante', famille: 'menuiserie', libelle: 'Baie coulissante', prefixe: 'BC', formeAttendue: null,
    aide: 'Mesurer la baie en 3 points dans chaque sens. Préciser le vantail de service et son sens de coulissement avec le point de vue.',
    dessin: () => R(30, 35, 240, 165) + R(38, 43, 116, 149, 'd-fin') + R(146, 47, 116, 141, 'd-fin')
      + P('M70 118 h40 m-8 -6 l8 6 l-8 6', 'd-ouv') + P('M230 118 h-40 m8 -6 l-8 6 l8 6', 'd-ouv') + sol(206),
    cotes: [...lh3(30, 35, 240, 165, 'tableau ou dormant'), ...diagonales(30, 35, 240, 165),
      facultatif(cote('P', 'P', 'Profondeur du tableau', 'profondeur', [270, 200, 296, 214])),
      facultatif(cote('RH', 'RH', 'Retour d’habillage disponible', 'retour', [10, 70, 30, 70])),
      facultatif(cote('T', 'T', 'Épaisseur de doublage (tapée)', 'tapee', [10, 150, 30, 150]))],
    poses: POSES_MENUISERIE,
    options: [MATERIAU_MENUISERIE,
      opt('rails', 'Vantaux / rails', { v2r2: '2 vantaux, 2 rails', v3r3: '3 vantaux, 3 rails', v4r2: '4 vantaux, 2 rails', galandage: 'Galandage', a_definir: 'À définir' }),
      opt('service', 'Vantail de service et coulissement (vu de l’EXTÉRIEUR)', { d_vers_g: 'Droite → gauche', g_vers_d: 'Gauche → droite' }),
      opt('seuil', 'Seuil', { standard: 'Standard', encastre: 'Encastré / réduit', a_definir: 'À définir' })],
    photos: ['exterieur', 'interieur'],
  },
  {
    id: 'porte_entree', famille: 'menuiserie', libelle: 'Porte d’entrée', prefixe: 'PTE', formeAttendue: 'haute',
    aide: 'Mesurer la baie en 3 points. Sens : côté des paumelles et poussant/tirant, vu de l’EXTÉRIEUR.',
    dessin: () => R(100, 8, 100, 204) + R(107, 15, 86, 197, 'd-fin') + R(180, 105, 6, 22, 'd-plein')
      + L(186, 20, 112, 110, 'd-ouv') + L(112, 110, 186, 205, 'd-ouv') + sol(),
    cotes: [...lh3(100, 8, 100, 204, 'tableau ou dormant'), ...diagonales(100, 8, 100, 204),
      facultatif(cote('T', 'T', 'Épaisseur de doublage (tapée)', 'tapee', [72, 60, 100, 60])),
      facultatif(cote('RH', 'RH', 'Retour d’habillage disponible', 'retour', [200, 60, 228, 60])),
      facultatif(cote('HS', 'HS', 'Hauteur de marche / seuil', 'autre', [215, 200, 215, 212]))],
    poses: POSES_MENUISERIE,
    options: [MATERIAU_MENUISERIE,
      opt('ouverture', 'Ouverture (vu de l’EXTÉRIEUR)', { poussant_g: 'Poussant, paumelles à gauche', poussant_d: 'Poussant, paumelles à droite', tirant_g: 'Tirant, paumelles à gauche', tirant_d: 'Tirant, paumelles à droite' }),
      opt('serrure', 'Serrure', { manuelle: 'Manuelle', automatique: 'Automatique', motorisee: 'Motorisée', a_definir: 'À définir' })],
    photos: ['exterieur', 'interieur'],
  },

  // ===== Portes de garage
  {
    id: 'garage_sectionnelle', famille: 'garage', libelle: 'Porte de garage sectionnelle', prefixe: 'GS', formeAttendue: null,
    aide: 'Relever la baie, la retombée de linteau, les écoinçons et la profondeur disponible au plafond (rails).',
    dessin: () => mur(0, 14, 300, 6) + T(150, 11, 'plafond', 'd-legende') + R(60, 50, 180, 150) + lames(60, 50, 180, 150, 4) + sol(200),
    cotes: [...lh2(60, 50, 180, 150, 'baie'),
      cote('RL', 'RL', 'Retombée de linteau (haut de baie → plafond)', 'autre', [150, 20, 150, 50]),
      cote('EG', 'EG', 'Écoinçon gauche', 'autre', [8, 120, 60, 120]),
      cote('ED', 'ED', 'Écoinçon droit', 'autre', [240, 120, 292, 120]),
      cote('PR', 'PR', 'Profondeur disponible au plafond', 'profondeur', [250, 26, 292, 44])],
    poses: { sous_linteau: 'Derrière la baie (sous linteau)', tableau: 'En tableau', a_definir: 'À définir' },
    options: [MOTORISATION, ALIM_MOTEUR, opt('portillon', 'Portillon intégré', { non: 'Non', oui: 'Oui' })],
    photos: ['exterieur', 'interieur'],
  },
  {
    id: 'garage_laterale', famille: 'garage', libelle: 'Porte de garage sectionnelle latérale', prefixe: 'GL',
    aide: 'Relever la baie, la retombée, l’écoinçon côté refoulement et la longueur de mur disponible pour le refoulement.',
    dessin: () => mur(0, 14, 300, 6) + R(70, 50, 170, 150) + Array.from({ length: 5 }, (_, i) => L(70 + (i + 1) * 28, 50, 70 + (i + 1) * 28, 200)).join('') + sol(200)
      + P('M200 125 h-90 m8 -6 l-8 6 l8 6', 'd-ouv'),
    cotes: [...lh2(70, 50, 170, 150, 'baie'),
      cote('RL', 'RL', 'Retombée de linteau', 'autre', [155, 20, 155, 50]),
      cote('ER', 'ER', 'Écoinçon côté refoulement', 'autre', [10, 120, 70, 120]),
      cote('EO', 'EO', 'Écoinçon côté opposé', 'autre', [240, 120, 292, 120]),
      cote('LR', 'LR', 'Longueur de mur de refoulement', 'profondeur', [10, 206, 70, 216])],
    poses: { sous_linteau: 'Derrière la baie', a_definir: 'À définir' },
    options: [opt('refoulement', 'Côté refoulement (vu de l’INTÉRIEUR)', { gauche: 'Gauche', droite: 'Droite' }), MOTORISATION, ALIM_MOTEUR],
    photos: ['exterieur', 'interieur'],
  },
  {
    id: 'garage_enroulable', famille: 'garage', libelle: 'Porte de garage enroulable', prefixe: 'GE',
    aide: 'Relever la baie, la retombée de linteau (logement du coffre) et les écoinçons (coulisses).',
    dessin: () => R(55, 22, 190, 34, 'd-plein') + T(150, 44, 'coffre', 'd-legende') + R(65, 56, 170, 144) + lames(65, 56, 170, 144, 9) + sol(200),
    cotes: [...lh2(65, 56, 170, 144, 'baie'),
      cote('RL', 'RL', 'Retombée de linteau disponible', 'autre', [255, 10, 255, 56]),
      cote('EG', 'EG', 'Écoinçon gauche', 'autre', [8, 130, 65, 130]),
      cote('ED', 'ED', 'Écoinçon droit', 'autre', [235, 130, 292, 130])],
    poses: { sous_linteau: 'Sous linteau (intérieur)', applique: 'En applique intérieure', facade: 'En façade', a_definir: 'À définir' },
    options: [MOTORISATION, ALIM_MOTEUR],
    photos: ['exterieur', 'interieur'],
  },

  // ===== Volets
  {
    id: 'vr_traditionnel', famille: 'volet', libelle: 'Volet roulant traditionnel (caisson)', prefixe: 'VRT',
    aide: 'Mesurer le tableau, puis l’intérieur du caisson existant (largeur, hauteur, profondeur).',
    dessin: () => R(60, 12, 180, 30, 'd-plein') + T(150, 31, 'caisson', 'd-legende') + R(70, 42, 160, 162) + lames(70, 42, 160, 162, 10) + sol(204),
    cotes: [...lh2(70, 42, 160, 162, 'tableau'),
      cote('LC', 'LC', 'Largeur intérieure du caisson', 'autre', [60, 6, 240, 6]),
      cote('HC', 'HC', 'Hauteur du caisson', 'autre', [250, 12, 250, 42]),
      cote('PC', 'PC', 'Profondeur du caisson', 'profondeur', [250, 50, 290, 62]),
      facultatif(cote('P', 'P', 'Profondeur du tableau (coulisses)', 'profondeur', [232, 204, 270, 214]))],
    poses: { caisson_existant: 'Dans caisson existant', a_definir: 'À définir' },
    options: [MANOEUVRE, COTE_MANOEUVRE_INT, ALIM, opt('lames', 'Lames', { alu: 'Aluminium', pvc: 'PVC', a_definir: 'À définir' })],
    photos: ['interieur', 'exterieur'],
  },
  {
    id: 'vr_tradi_tunnel', famille: 'volet', libelle: 'Volet roulant tradi-tunnel', prefixe: 'VRTT',
    aide: 'Mesurer le tableau et la profondeur disponible. Préciser la hauteur du coffre tunnel.',
    dessin: () => R(70, 12, 160, 30, 'd-plein') + T(150, 31, 'coffre tunnel', 'd-legende') + R(70, 42, 160, 162) + lames(70, 42, 160, 162, 10) + sol(204),
    cotes: [...lh2(70, 42, 160, 162, 'tableau'),
      cote('P', 'P', 'Profondeur du tableau', 'profondeur', [232, 204, 270, 214]),
      facultatif(cote('HT', 'HT', 'Hauteur disponible pour le coffre', 'autre', [250, 12, 250, 42]))],
    poses: { tunnel: 'Tunnel', a_definir: 'À définir' },
    options: [opt('hauteurCoffre', 'Coffre tunnel', { h280: '280 mm', h300: '300 mm', a_definir: 'À définir' }), MANOEUVRE, COTE_MANOEUVRE_INT, ALIM],
    photos: ['interieur', 'exterieur'],
  },
  {
    id: 'vr_monobloc', famille: 'volet', libelle: 'Volet roulant monobloc', prefixe: 'VRM',
    aide: 'Coffre posé sur la menuiserie : mesurer la baie comme pour la menuiserie, plus l’épaisseur de doublage.',
    dessin: () => R(70, 12, 160, 34, 'd-plein') + T(76, 42, 'coffre', 'd-legende', 'start') + dessinFenetre(70, 46, 160, 158, 2) + sol(204),
    cotes: [...lh3(70, 12, 160, 192, 'baie'),
      cote('T', 'T', 'Épaisseur de doublage (tapée)', 'tapee', [40, 120, 70, 120]),
      facultatif(cote('HC', 'HC', 'Hauteur du coffre', 'autre', [250, 12, 250, 46]))],
    poses: POSES_MENUISERIE,
    options: [opt('typeCoffre', 'Coffre', { interieur: 'Caisson intérieur', a_definir: 'À définir' }), MANOEUVRE, COTE_MANOEUVRE_INT, ALIM],
    photos: ['interieur', 'exterieur'],
  },
  {
    id: 'vr_blocbaie', famille: 'volet', libelle: 'Volet roulant bloc-baie', prefixe: 'VRB',
    aide: 'Ensemble menuiserie + coffre : mesurer la baie complète. Préciser caisson intérieur ou ½ linteau.',
    dessin: () => R(70, 12, 160, 34, 'd-plein') + T(76, 42, 'coffre', 'd-legende', 'start') + dessinFenetre(70, 46, 160, 158, 2) + sol(204),
    cotes: [...lh3(70, 12, 160, 192, 'baie'),
      cote('T', 'T', 'Épaisseur de doublage (tapée)', 'tapee', [40, 120, 70, 120]),
      facultatif(cote('RL', 'RL', 'Retombée de linteau', 'autre', [250, 12, 250, 46]))],
    poses: { neuf: 'Construction neuve', renovation: 'Rénovation', a_definir: 'À définir' },
    options: [opt('typeCoffre', 'Coffre', { caisson_int: 'Bloc caisson intérieur', demi_linteau: 'Bloc ½ linteau', a_definir: 'À définir' }), MANOEUVRE, COTE_MANOEUVRE_INT, ALIM],
    photos: ['interieur', 'exterieur'],
  },
  {
    id: 'volet_battant', famille: 'volet', libelle: 'Volet battant', prefixe: 'VB',
    aide: 'Mesurer le tableau. Vérifier la place disponible en façade pour rabattre chaque vantail.',
    dessin: () => R(70, 20, 80, 180) + R(150, 20, 80, 180)
      + [70, 150].map((x) => L(x, 50, x + 80, 50) + L(x, 170, x + 80, 170) + L(x, 50, x + 80, 170)).join('') + sol(204),
    cotes: [...lh2(70, 20, 160, 180, 'tableau'),
      cote('RG', 'RG', 'Rabattement disponible à gauche', 'autre', [8, 110, 70, 110]),
      cote('RD', 'RD', 'Rabattement disponible à droite', 'autre', [230, 110, 292, 110]),
      facultatif(cote('P', 'P', 'Profondeur du tableau', 'profondeur', [232, 204, 270, 214]))],
    poses: { gonds_existants: 'Sur gonds existants', gonds_neufs: 'Gonds neufs', a_definir: 'À définir' },
    options: [opt('vantaux', 'Nombre de vantaux', { v1: '1', v2: '2', v3: '3', v4: '4 (repliables)' }),
      opt('materiau', 'Matériau', { alu: 'Aluminium', pvc: 'PVC', bois: 'Bois', a_definir: 'À définir' }), SUPPORT],
    photos: ['exterieur'],
  },

  // ===== Stores
  {
    id: 'store_banne_coffre', famille: 'store', libelle: 'Store banne coffre', prefixe: 'SBC',
    aide: 'Vue de côté. Relever la largeur disponible en façade, la hauteur de fixation, l’avancée souhaitée et la pente.',
    dessin: () => dessinStoreCote(true),
    cotes: [
      cote('LP', 'L', 'Largeur de pose disponible (façade)', 'largeur', [70, 14, 290, 14]),
      cote('HP', 'H', 'Hauteur de fixation (sol → support)', 'hauteur', [18, 48, 18, 212]),
      cote('AV', 'A', 'Avancée souhaitée', 'profondeur', [40, 150, 252, 150]),
      cote('PE', '°', 'Pente de la toile', 'pente', [66, 50, 252, 96], { unite: 'deg' }),
      facultatif(cote('HL', 'HL', 'Hauteur libre sous la barre de charge', 'autre', [262, 112, 262, 212]))],
    poses: { facade: 'Façade', plafond: 'Plafond', sous_linteau: 'Sous linteau / tableau', a_definir: 'À définir' },
    options: [MANOEUVRE, ALIM, SUPPORT, opt('obstacles', 'Obstacles en façade (gouttière, volet, lampe…)', { non: 'Non', oui: 'Oui (préciser en observation)' })],
    photos: ['exterieur'],
  },
  {
    id: 'store_banne_monobloc', famille: 'store', libelle: 'Store banne monobloc', prefixe: 'SBM',
    aide: 'Vue de côté. Mêmes relevés que le store coffre (largeur, hauteur de fixation, avancée, pente).',
    dessin: () => dessinStoreCote(false),
    cotes: [
      cote('LP', 'L', 'Largeur de pose disponible (façade)', 'largeur', [70, 14, 290, 14]),
      cote('HP', 'H', 'Hauteur de fixation (sol → support)', 'hauteur', [18, 48, 18, 212]),
      cote('AV', 'A', 'Avancée souhaitée', 'profondeur', [40, 150, 252, 150]),
      cote('PE', '°', 'Pente de la toile', 'pente', [50, 50, 252, 96], { unite: 'deg' }),
      facultatif(cote('HL', 'HL', 'Hauteur libre sous la barre de charge', 'autre', [262, 112, 262, 212]))],
    poses: { facade: 'Façade', plafond: 'Plafond', a_definir: 'À définir' },
    options: [MANOEUVRE, ALIM, SUPPORT, opt('obstacles', 'Obstacles en façade (gouttière, volet, lampe…)', { non: 'Non', oui: 'Oui (préciser en observation)' })],
    photos: ['exterieur'],
  },
  {
    id: 'store_screen', famille: 'store', libelle: 'Store screen (toile verticale)', prefixe: 'SCR',
    aide: 'Mesurer le tableau (pose tableau) ou la zone à couvrir (pose façade). Profondeur utile pour les coulisses.',
    dessin: () => R(72, 14, 156, 26, 'd-plein') + T(150, 31, 'coffre', 'd-legende') + R(80, 40, 140, 164, 'd-toile-zone')
      + L(80, 40, 80, 204, 'd-trait') + L(220, 40, 220, 204, 'd-trait') + sol(204),
    cotes: [...lh2(80, 40, 140, 164, 'tableau ou zone'),
      facultatif(cote('HC', 'HC', 'Hauteur disponible pour le coffre', 'autre', [240, 14, 240, 40])),
      facultatif(cote('P', 'P', 'Profondeur du tableau', 'profondeur', [232, 204, 270, 214]))],
    poses: { tableau: 'En tableau', facade: 'En façade', a_definir: 'À définir' },
    options: [MANOEUVRE, ALIM, opt('toile', 'Toile', { a_definir: 'À définir (coloris / opacité)' }, { obligatoire: false })],
    photos: ['exterieur'],
  },

  // ===== Extérieurs
  {
    id: 'portail_coulissant', famille: 'exterieur', libelle: 'Portail coulissant', prefixe: 'PC',
    aide: 'Mesurer le passage entre piliers (haut et bas), la hauteur des piliers, la longueur de refoulement et la pente du sol.',
    dessin: () => mur(0, 150, 110, 6) + R(110, 60, 20, 152, 'd-plein') + R(260, 60, 20, 152, 'd-plein')
      + R(130, 85, 130, 112) + lames(130, 85, 130, 112, 0) + Array.from({ length: 6 }, (_, i) => L(130 + (i + 1) * 18.5, 85, 130 + (i + 1) * 18.5, 197)).join('')
      + R(10, 85, 100, 112, 'd-pointille') + T(60, 145, 'refoulement', 'd-legende') + sol(),
    cotes: [
      cote('L1', 'L1', 'Passage entre piliers – haut', 'largeur', [130, 72, 260, 72]),
      cote('L2', 'L2', 'Passage entre piliers – bas', 'largeur', [130, 205, 260, 205]),
      cote('H1', 'H1', 'Hauteur pilier gauche', 'hauteur', [104, 60, 104, 212]),
      cote('H2', 'H2', 'Hauteur pilier droit', 'hauteur', [286, 60, 286, 212]),
      cote('HP', 'HP', 'Hauteur de portail souhaitée', 'hauteur', [195, 85, 195, 197], { groupe: null }),
      cote('LR', 'LR', 'Longueur de refoulement disponible', 'autre', [10, 78, 110, 78]),
      cote('EP', 'EP', 'Épaisseur des piliers', 'profondeur', [110, 52, 130, 52]),
      cote('PS', '°', 'Pente du sol (passage)', 'pente', [130, 212, 260, 206], { unite: 'deg' })],
    poses: { entre_piliers: 'Entre piliers', applique: 'En applique (derrière piliers)', a_definir: 'À définir' },
    options: [opt('refoulement', 'Côté refoulement (vu de l’INTÉRIEUR / cour)', { gauche: 'Gauche', droite: 'Droite' }), MOTORISATION, ALIM_MOTEUR],
    photos: ['exterieur', 'interieur'],
  },
  {
    id: 'portail_battant', famille: 'exterieur', libelle: 'Portail battant', prefixe: 'PB',
    aide: 'Mesurer le passage entre piliers (haut et bas), la hauteur et l’épaisseur des piliers, la pente du sol côté ouverture.',
    dessin: () => R(30, 60, 25, 152, 'd-plein') + R(245, 60, 25, 152, 'd-plein') + R(55, 85, 95, 112) + R(150, 85, 95, 112)
      + [55, 150].map((x) => Array.from({ length: 4 }, (_, i) => L(x + (i + 1) * 19, 85, x + (i + 1) * 19, 197)).join('')).join('') + sol(),
    cotes: [
      cote('L1', 'L1', 'Passage entre piliers – haut', 'largeur', [55, 72, 245, 72]),
      cote('L2', 'L2', 'Passage entre piliers – bas', 'largeur', [55, 205, 245, 205]),
      cote('H1', 'H1', 'Hauteur pilier gauche', 'hauteur', [20, 60, 20, 212]),
      cote('H2', 'H2', 'Hauteur pilier droit', 'hauteur', [280, 60, 280, 212]),
      cote('HP', 'HP', 'Hauteur de portail souhaitée', 'hauteur', [102, 85, 102, 197], { groupe: null }),
      cote('EP', 'EP', 'Épaisseur des piliers', 'profondeur', [30, 52, 55, 52]),
      cote('PS', '°', 'Pente du sol côté ouverture', 'pente', [55, 212, 245, 204], { unite: 'deg' }),
      facultatif(cote('DO', 'DO', 'Dégagement libre d’ouverture (côté cour)', 'profondeur', [150, 30, 150, 58]))],
    poses: { entre_piliers: 'Entre piliers', applique: 'En applique', a_definir: 'À définir' },
    options: [opt('ouverture', 'Ouverture', { interieur: 'Vers l’intérieur (cour)', exterieur: 'Vers l’extérieur', a_definir: 'À définir' }), MOTORISATION, ALIM_MOTEUR, SUPPORT],
    photos: ['exterieur', 'interieur'],
  },
  {
    id: 'pergola_orientable', famille: 'exterieur', libelle: 'Pergola bioclimatique (lames orientables)', prefixe: 'PGO',
    aide: 'Relever largeur, avancée, hauteur de fixation au mur et hauteur sous poutre, pente du terrain. Repérer gouttières et descentes.',
    dessin: () => mur(0, 10, 300, 8) + R(30, 46, 240, 20, 'd-plein') + Array.from({ length: 11 }, (_, i) => L(30 + (i + 1) * 20, 46, 30 + (i + 1) * 20, 66)).join('')
      + R(38, 66, 10, 146, 'd-plein') + R(252, 66, 10, 146, 'd-plein') + sol(),
    cotes: [
      cote('L', 'L', 'Largeur', 'largeur', [30, 36, 270, 36]),
      cote('AV', 'A', 'Avancée (depuis le mur)', 'profondeur', [270, 212, 296, 196]),
      cote('HF', 'HF', 'Hauteur de fixation au mur', 'hauteur', [16, 46, 16, 212], { groupe: null }),
      cote('HS', 'HS', 'Hauteur sous poutre (passage)', 'hauteur', [150, 66, 150, 212]),
      cote('PT', '°', 'Pente du terrain', 'pente', [48, 212, 252, 206], { unite: 'deg' })],
    poses: { adossee: 'Adossée (fixée au mur)', autoportante: 'Autoportante', a_definir: 'À définir' },
    options: [MOTORISATION, ALIM_MOTEUR, SUPPORT, opt('sol', 'Sol sous les poteaux', { dalle: 'Dalle béton', terrasse: 'Terrasse (bois / carrelage)', terre: 'Terre', a_verifier: 'À vérifier' })],
    photos: ['exterieur'],
  },
  {
    id: 'pergola_pleine', famille: 'exterieur', libelle: 'Pergola toiture pleine', prefixe: 'PGP',
    aide: 'Relever largeur, avancée, hauteurs de fixation et sous poutre, pente de toiture et du terrain.',
    dessin: () => mur(0, 10, 300, 8) + P('M30 40 L270 58 L270 70 L30 52 Z', 'd-plein') + R(38, 64, 10, 148, 'd-plein') + R(252, 70, 10, 142, 'd-plein') + sol(),
    cotes: [
      cote('L', 'L', 'Largeur', 'largeur', [30, 30, 270, 30]),
      cote('AV', 'A', 'Avancée (depuis le mur)', 'profondeur', [270, 212, 296, 196]),
      cote('HF', 'HF', 'Hauteur de fixation au mur', 'hauteur', [16, 46, 16, 212], { groupe: null }),
      cote('HS', 'HS', 'Hauteur sous poutre (passage)', 'hauteur', [150, 66, 150, 212]),
      cote('PTO', '°T', 'Pente de toiture', 'pente', [30, 46, 270, 64], { unite: 'deg' }),
      facultatif(cote('PT', '°S', 'Pente du terrain', 'pente', [48, 212, 252, 206], { unite: 'deg' }))],
    poses: { adossee: 'Adossée (fixée au mur)', autoportante: 'Autoportante', a_definir: 'À définir' },
    options: [SUPPORT, opt('sol', 'Sol sous les poteaux', { dalle: 'Dalle béton', terrasse: 'Terrasse (bois / carrelage)', terre: 'Terre', a_verifier: 'À vérifier' }),
      opt('evacuation', 'Évacuation des eaux pluviales', { a_definir: 'À définir (préciser en observation)' }, { obligatoire: false })],
    photos: ['exterieur'],
  },
  {
    id: 'carport', famille: 'exterieur', libelle: 'Carport', prefixe: 'CP',
    aide: 'Relever l’emprise (largeur × profondeur), la hauteur de passage, la pente de toiture et du sol.',
    dessin: () => P('M20 46 L280 64 L280 76 L20 58 Z', 'd-plein') + R(30, 58, 10, 154, 'd-plein') + R(260, 74, 10, 138, 'd-plein')
      + R(95, 150, 110, 50, 'd-pointille') + T(150, 180, 'véhicule', 'd-legende') + sol(),
    cotes: [
      cote('L', 'L', 'Largeur (emprise)', 'largeur', [20, 34, 280, 34]),
      cote('PR', 'P', 'Profondeur (emprise)', 'profondeur', [270, 212, 296, 196]),
      cote('HS', 'H', 'Hauteur de passage', 'hauteur', [150, 70, 150, 212]),
      cote('PTO', '°T', 'Pente de toiture', 'pente', [20, 52, 280, 70], { unite: 'deg' }),
      facultatif(cote('PT', '°S', 'Pente du sol', 'pente', [40, 212, 260, 206], { unite: 'deg' }))],
    poses: { autoportant: 'Autoportant', adosse: 'Adossé', a_definir: 'À définir' },
    options: [SUPPORT, opt('sol', 'Sol sous les poteaux', { dalle: 'Dalle béton', enrobe: 'Enrobé', terre: 'Terre', a_verifier: 'À vérifier' })],
    photos: ['exterieur'],
  },
];

// ===== SAV / vitrage (ajouté après le catalogue principal)
PRODUITS.push({
  id: 'casse_vitrage', famille: 'sav', libelle: 'Remplacement de casse (vitrage)', prefixe: 'V',
  aide: 'Relever CÔTÉ PARCLOSES : clair de vitre (CDV) ou fond de feuillure (FF) selon la série, l’épaisseur totale et la composition. Photos : vitrage, intercalaire, parcloses. Calcul par l’abaque interne LDM (indicatif).',
  dessin: () => R(60, 20, 180, 180) + R(78, 38, 144, 144, 'd-pointille') + R(86, 46, 128, 128, 'd-toile-zone') + R(96, 56, 108, 108, 'd-fin')
    + T(150, 120, 'vitrage', 'd-legende') + T(150, 214, 'Vue côté parcloses', 'd-legende'),
  cotes: [
    cote('CDVL', 'CDV L', 'Clair de vitre – largeur', 'largeur', [96, 80, 204, 80], { obligatoire: false }),
    cote('CDVH', 'CDV H', 'Clair de vitre – hauteur', 'hauteur', [124, 56, 124, 164], { obligatoire: false }),
    cote('FFL', 'FF L', 'Fond de feuillure – largeur', 'largeur', [78, 190, 222, 190], { obligatoire: false, groupe: null }),
    cote('FFH', 'FF H', 'Fond de feuillure – hauteur', 'hauteur', [68, 38, 68, 182], { obligatoire: false, groupe: null, t: 0.3 }),
    cote('NL', 'N L', 'Cote nette relevée sur l’ancien vitrage – largeur', 'autre', [86, 152, 214, 152], { obligatoire: false }),
    cote('NH', 'N H', 'Cote nette relevée sur l’ancien vitrage – hauteur', 'autre', [182, 46, 182, 174], { obligatoire: false, t: 0.7 }),
    cote('EP', 'ÉP', 'Épaisseur totale mesurée du vitrage', 'profondeur', [246, 100, 290, 100], { decimal: true, min: 3, max: 80 }),
  ],
  options: [
    opt('serie', 'Série / type de menuiserie (abaque)', choixDe(SERIES_CASSE)),
    opt('typeMenuiserie', 'Type de menuiserie', { fixe: 'Fixe', of: 'Ouvrant à la française', coulissant: 'Coulissant', autre: 'Autre' }),
    opt('parcloses', 'Parcloses côté', { interieur: 'Intérieur', exterieur: 'Extérieur' }),
    opt('verreExt', 'Verre face extérieure', choixDe(VERRES)),
    opt('intercalaire', 'Intercalaire', choixDe(INTERCALAIRES)),
    opt('verreInt', 'Verre face intérieure', choixDe(VERRES), { siOption: { intercalaire: Object.keys(INTERCALAIRES).filter((k) => k !== 'sv') } }),
    opt('teinte', 'Teinte', { claire: 'Claire', granite: 'Granité', opale: 'Opale', autre: 'Autre (préciser en observation)' }),
    opt('couleurIntercalaire', 'Couleur de l’intercalaire', { alu: 'Alu', noir: 'Noir', blanc: 'Blanc', autre: 'Autre' }, { obligatoire: false }),
  ],
  photos: ['exterieur', 'technique'],
  calcul: calculCasse,
});

export const produit = (id) => PRODUITS.find((p) => p.id === id) || null;
export const coteDe = (p, id) => p?.cotes.find((c) => c.id === id) || null;
