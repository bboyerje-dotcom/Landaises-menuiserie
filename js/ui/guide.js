// Guide des relevés : toutes les illustrations et les cotes à prendre, par famille.
import { PRODUITS, FAMILLES } from '../catalogue/produits.js';
import { TYPES_COTE, couleurCote } from '../catalogue/types-cotes.js';
import { illustration } from './dessin.js';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const legendeCouleurs = (types = Object.keys(TYPES_COTE)) => `<ul class="legende-cotes" data-test="legende">${types.map((t) =>
  `<li><span class="pastille" style="background:${couleurCote(t)}"></span>${esc(TYPES_COTE[t].libelle)}</li>`).join('')}</ul>`;

export function ecranGuide(app) {
  app.innerHTML = `
    <p class="doux"><a href="#/">← Dossiers</a></p>
    <h1>Guide des relevés</h1>
    <div class="bandeau alerte">Version 1 à valider par le responsable technique : points de mesure de principe, pas des prescriptions fabricant. Schémas non à l’échelle.</div>
    <h2>Code couleur des cotes</h2>
    ${legendeCouleurs()}
    ${Object.entries(FAMILLES).map(([f, nom]) => `
      <h2>${esc(nom)}</h2>
      ${PRODUITS.filter((p) => p.famille === f).map((p) => `
        <section class="carte guide-produit" data-test="guide-${p.id}">
          <h3>${esc(p.libelle)}</h3>
          ${illustration(p)}
          <p class="doux">${esc(p.aide || '')}</p>
          <ul class="cotes-liste">${p.cotes.map((c) => `<li><span class="code" style="--c:${couleurCote(c.type)}">${esc(c.code)}</span> ${esc(c.libelle)}${c.unite === 'deg' ? ' (°)' : ' (mm)'}${c.obligatoire ? '' : ' <span class="doux">– facultatif</span>'}</li>`).join('')}</ul>
        </section>`).join('')}`).join('')}`;
}
