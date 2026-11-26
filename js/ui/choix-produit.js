// Écran « Quel produit relever ? » : cartes illustrées par famille.
import { PRODUITS, FAMILLES } from '../catalogue/produits.js';
import { lireDossier } from '../storage/db.js';
import { illustration } from './dessin.js';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export async function ecranChoixProduit(app, dossierId) {
  const d = await lireDossier(dossierId);
  if (!d) {
    app.innerHTML = `<div class="bandeau erreur" role="alert">Dossier introuvable sur cet appareil.</div><a class="btn" href="#/">Retour</a>`;
    return;
  }
  app.innerHTML = `
    <p class="doux"><a href="#/dossier/${encodeURIComponent(d.id)}">← ${esc(d.reference)} · ${esc(d.clientNom)}</a></p>
    <h1>Quel produit relever ?</h1>
    ${Object.entries(FAMILLES).map(([f, nom]) => `<h2>${esc(nom)}</h2>
      <div class="choix-produits">${PRODUITS.filter((p) => p.famille === f).map((p) => `
        <a class="carte-produit" href="#/dossier/${encodeURIComponent(d.id)}/ouvrage/nouveau?produit=${p.id}" data-test="produit-${p.id}">
          ${illustration(p)}${esc(p.libelle)}</a>`).join('')}</div>`).join('')}`;
}
