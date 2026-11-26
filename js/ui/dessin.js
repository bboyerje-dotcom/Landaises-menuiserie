// Dessin des cotes (illustration, photo, PDF) : même rendu partout.
import { couleurCote } from '../catalogue/types-cotes.js';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const libelleValeur = (c, v) => (v == null || v === '' || Number.isNaN(v) ? c.code : `${c.code} ${v}${c.unite === 'deg' ? '°' : ''}`);

// Une cote = trait + 2 flèches + étiquette sur fond blanc. `e` = échelle (1 sur l'illustration 300×220).
// Renvoie { trait, etiquette } : on dessine tous les traits PUIS toutes les étiquettes, pour
// qu'aucun trait ne masque une valeur.
export function partiesCote(c, [x1, y1, x2, y2], valeur, e = 1, { poignees = false, attenuee = false } = {}) {
  const col = couleurCote(c.type);
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  const a = 7 * e, b = 3.2 * e;
  const tete = (x, y, s) => `${x},${y} ${x - s * ux * a - uy * b},${y - s * uy * a + ux * b} ${x - s * ux * a + uy * b},${y - s * uy * a - ux * b}`;
  const pente = c.type === 'pente';
  const txt = libelleValeur(c, valeur);
  const fs = 10 * e, w = (txt.length * 0.6 + 0.8) * fs, h = fs * 1.35;
  const t = c.t ?? 0.5; // position de l'étiquette le long du trait
  const mx = x1 + dx * t, my = y1 + dy * t;
  const cls = `cote${attenuee ? ' attenuee' : ''}`;
  return {
    trait: `<g class="${cls}" data-cote-trait="${esc(c.id)}">
      <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col}" stroke-width="${2.2 * e}" ${pente ? `stroke-dasharray="${6 * e} ${3 * e}"` : ''}/>
      ${pente ? '' : `<polygon points="${tete(x2, y2, 1)}" fill="${col}"/><polygon points="${tete(x1, y1, -1)}" fill="${col}"/>`}</g>`,
    etiquette: `<g class="${cls}" data-cote="${esc(c.id)}">
      <rect x="${mx - w / 2}" y="${my - h / 2}" width="${w}" height="${h}" rx="${2 * e}" fill="#fff" stroke="${col}" stroke-width="${1 * e}"/>
      <text x="${mx}" y="${my + fs * 0.36}" font-size="${fs}" font-weight="700" text-anchor="middle" fill="${col}" font-family="system-ui, sans-serif">${esc(txt)}</text>
      ${poignees ? `<circle class="poignee" data-bout="1" cx="${x1}" cy="${y1}" r="${10 * e}" fill="${col}" fill-opacity=".35" stroke="${col}" stroke-width="${1.5 * e}"/>
        <circle class="poignee" data-bout="2" cx="${x2}" cy="${y2}" r="${10 * e}" fill="${col}" fill-opacity=".35" stroke="${col}" stroke-width="${1.5 * e}"/>` : ''}</g>`,
  };
}
const assembler = (parties) => parties.map((p) => p.trait).join('') + parties.map((p) => p.etiquette).join('');

// Illustration d'un produit avec ses cotes (valeurs facultatives).
export function illustration(produit, valeurs = {}, { classe = 'illus' } = {}) {
  return `<svg class="${classe}" viewBox="0 0 300 220" role="img" aria-label="Schéma : ${esc(produit.libelle)}">
    <g class="structure">${produit.dessin()}</g>
    ${assembler(produit.cotes.map((c) => {
      const v = valeurs[c.id];
      const vide = v == null || v === '' || Number.isNaN(v);
      return partiesCote(c, c.trait, vide ? null : v, 1, { attenuee: Object.keys(valeurs).length > 0 && vide });
    }))}
  </svg>`;
}

// Trait par défaut d'une cote sur une photo (W × H) : homothétie depuis le repère 300 × 220.
export const traitParDefaut = (c, W, H) => [c.trait[0] * W / 300, c.trait[1] * H / 220, c.trait[2] * W / 300, c.trait[3] * H / 220];
export const versNormalise = (t, W, H) => [t[0] / W, t[1] / H, t[2] / W, t[3] / H];
export const depuisNormalise = (n, W, H) => [n[0] * W, n[1] * H, n[2] * W, n[3] * H];

// Calque des cotes renseignées sur une photo. `annotations` : positions ajustées (normalisées 0–1).
export function svgCotesPhoto(produit, W, H, valeurs, annotations = {}, { poignees = false, vue = '' } = {}) {
  const e = Math.max(W, H) / 300; // traits et textes proportionnels à la photo
  const renseignees = produit.cotes.filter((c) => valeurs[c.id] != null && valeurs[c.id] !== '' && !Number.isNaN(valeurs[c.id]));
  const badge = vue ? `<g><rect x="${6 * e}" y="${6 * e}" width="${(vue.length * 0.62 + 1.2) * 9 * e}" height="${14 * e}" rx="${3 * e}" fill="#111" fill-opacity=".75"/>
    <text x="${12 * e}" y="${16.5 * e}" font-size="${9 * e}" font-weight="800" fill="#fff" font-family="system-ui, sans-serif">${esc(vue)}</text></g>` : '';
  return `<svg class="calque-cotes" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" data-test="calque-cotes">
    ${assembler(renseignees.map((c) => partiesCote(c, annotations[c.id] ? depuisNormalise(annotations[c.id], W, H) : traitParDefaut(c, W, H), valeurs[c.id], e, { poignees })))}
    ${badge}
  </svg>`;
}
