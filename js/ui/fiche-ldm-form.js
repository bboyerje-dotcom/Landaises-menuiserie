// Rendu et visibilité des champs de la fiche LDM dans le formulaire fenêtre.
import { CHAMPS_LDM, nomChampLdm } from '../catalogue/fiche-ldm.js';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function champ(c) {
  const n = nomChampLdm(c);
  const aide = c.aide ? `<p class="doux aide">${esc(c.aide)}</p>` : '';
  const err = `<div class="msg-champ" id="err-${n}"></div>`;
  let corps;
  if (c.type === 'radio') corps = `<fieldset><legend>${esc(c.libelle)}${c.obligatoire ? ' <span class="obl-cond" title="Obligatoire selon le cas">*</span>' : ''}</legend>${aide}
    <div class="choix">${Object.entries(c.choix).map(([v, l]) => `<label><input type="radio" name="${n}" value="${v}"> ${esc(l)}</label>`).join('')}</div>${err}</fieldset>`;
  else if (c.type === 'cases') corps = `<fieldset><legend>${esc(c.libelle)}</legend>
    <div class="choix">${Object.entries(c.choix).map(([v, l]) => `<label><input type="checkbox" name="${nomChampLdm(c, v)}"> ${esc(l)}</label>`).join('')}</div>${err}</fieldset>`;
  else if (c.type === 'case') corps = `<div class="case"><label><input type="checkbox" name="${n}"> <span>${esc(c.libelle)}</span></label></div>`;
  else if (c.type === 'mm') corps = `<label for="${n}">${esc(c.libelle)}</label><div class="mm"><input id="${n}" name="${n}" type="text" inputmode="numeric" autocomplete="off"><span>mm</span></div>${err}`;
  else corps = `<label for="${n}">${esc(c.libelle)}${c.obligatoire ? ' <span class="obl-cond">*</span>' : ''}</label><input id="${n}" name="${n}" type="text">${err}`;
  return `<div data-ldm="${c.id}">${corps}</div>`;
}

export const formulaireLdm = () => CHAMPS_LDM.map(champ).join('');

// `o` : ouvrage normalisé complet (avec ldm), calculé sur TOUTES les valeurs du formulaire.
export function majVisibiliteLdm(f, o) {
  for (const c of CHAMPS_LDM) {
    const bloc = f.querySelector(`[data-ldm="${c.id}"]`);
    if (bloc) bloc.hidden = c.si ? !c.si(o) : false;
  }
}
