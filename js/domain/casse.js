// Calcul indicatif du remplacement de casse à partir de l'abaque interne. Module pur.
import { SERIES_CASSE, VERRES, INTERCALAIRES, TOLERANCE_EPAISSEUR_MM, ECART_NETTE_RELEVEE_MM, SOURCE_ABAQUE } from '../config/abaque-casse.js';

const ok = (v) => v != null && !Number.isNaN(v);
const arr = (x) => Math.round(x * 10) / 10;

// Composition : épaisseur totale théorique et libellé (ex. « 4/16/4 »).
export function composition(options) {
  const ext = VERRES[options.verreExt], inter = INTERCALAIRES[options.intercalaire], int = VERRES[options.verreInt];
  if (!ext || !inter) return null;
  if (options.intercalaire === 'sv') return { libelle: `Simple vitrage ${ext.libelle}`, e: ext.e };
  if (!int) return null;
  return { libelle: `${ext.libelle} / ${inter.libelle} / ${int.libelle}`, e: arr(ext.e + inter.e + int.e) };
}

// Retourne { lignes: [[libellé, valeur]], manquants: [{champ,msg}], alertes: [{champ,msg}], nette: {L,H} | null }
export function calculCasse(o) {
  const lignes = [], manquants = [], alertes = [];
  const c = o.cotes || {}, opt = o.options || {};
  const s = SERIES_CASSE[opt.serie];
  let nette = null;

  const comp = composition(opt);
  if (comp) lignes.push(['Composition', `${comp.libelle} → ${String(comp.e).replace('.', ',')} mm`]);
  if (opt.intercalaire === 'sv' && opt.verreInt) alertes.push({ champ: 'opt_verreInt', msg: 'Simple vitrage : un verre intérieur est aussi renseigné.' });
  if (comp && ok(c.EP) && Math.abs(c.EP - comp.e) > TOLERANCE_EPAISSEUR_MM)
    alertes.push({ champ: 'cote_EP', msg: `Épaisseur mesurée (${c.EP} mm) différente de la composition (${String(comp.e).replace('.', ',')} mm) : contrôler verres et intercalaire.` });
  if (!s) return { lignes, manquants, alertes, nette };

  const epaisseurReelle = ok(c.EP) ? c.EP : comp?.e;
  if (s.epaisseur && epaisseurReelle != null && Math.abs(epaisseurReelle - s.epaisseur) > TOLERANCE_EPAISSEUR_MM)
    alertes.push({ champ: 'cote_EP', msg: `${s.libelle} : l’abaque prévoit un vitrage de ${s.epaisseur} mm (relevé : ${String(epaisseurReelle).replace('.', ',')} mm). Règle à confirmer.` });

  const cdv = ok(c.CDVL) && ok(c.CDVH);
  const ff = ok(c.FFL) && ok(c.FFH);
  if (s.sansRegle) {
    alertes.push({ champ: 'opt_serie', msg: `${s.libelle} : pas de règle dans l’abaque. Cote nette à déterminer (mesure de l’ancien vitrage ou fabricant).` });
    if (!cdv && !(ok(c.NL) && ok(c.NH))) manquants.push({ champ: 'cote_CDVL', msg: 'Relever le clair de vitre ou la cote nette de l’ancien vitrage.' });
  } else if (s.plage) {
    if (!cdv) manquants.push({ champ: 'cote_CDVL', msg: 'Clair de vitre (L et H) non relevé : base du calcul pour cette série.' });
    else {
      const [a, b] = s.plage;
      lignes.push(['Cote nette indicative', `entre ${c.CDVL + a} × ${c.CDVH + a} et ${c.CDVL + b} × ${c.CDVH + b} mm (CDV +${a} à +${b})`]);
      alertes.push({ champ: 'opt_serie', msg: `${s.libelle} : écart variable (+${a} à +${b} mm) selon le profil. Cote nette à préciser.` });
    }
  } else if (s.base === 'CDV') {
    if (cdv) {
      nette = { L: c.CDVL + s.dL, H: c.CDVH + s.dH };
      lignes.push(['Cote nette indicative', `${nette.L} × ${nette.H} mm (CDV +${s.dL} / +${s.dH})`]);
    } else if (s.alternative && ff) {
      const d = s.alternative.d;
      nette = { L: c.FFL + d, H: c.FFH + d };
      lignes.push(['Cote nette indicative', `${nette.L} × ${nette.H} mm (FF ${d})`]);
    } else manquants.push({ champ: 'cote_CDVL', msg: `Clair de vitre (L et H) non relevé${s.alternative ? ' (ou fond de feuillure)' : ''} : base du calcul pour cette série.` });
  } else if (s.base === 'FF') {
    if (ff) {
      nette = { L: c.FFL + s.dL, H: c.FFH + s.dH };
      lignes.push(['Cote nette indicative', `${nette.L} × ${nette.H} mm (FF ${s.dL} / ${s.dH})`]);
    } else manquants.push({ champ: 'cote_FFL', msg: 'Fond de feuillure (L et H) non relevé : base du calcul pour cette série.' });
  }

  if (nette && ok(c.NL) && ok(c.NH)) {
    const e = Math.max(Math.abs(c.NL - nette.L), Math.abs(c.NH - nette.H));
    if (e > ECART_NETTE_RELEVEE_MM)
      alertes.push({ champ: 'cote_NL', msg: `Cote nette relevée (${c.NL} × ${c.NH}) différente de l’abaque (${nette.L} × ${nette.H}) de ${e} mm : vérifier la série ou la mesure.` });
  }
  if (lignes.length) lignes.push(['Source', `${SOURCE_ABAQUE} — indicatif, à valider avant commande`]);
  return { lignes, manquants, alertes, nette };
}
