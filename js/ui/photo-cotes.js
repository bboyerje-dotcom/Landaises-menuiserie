// Photo de l'ouvrage avec les cotes renseignées dessinées dessus (code couleur), ajustables au doigt.
import { CATEGORIES_PHOTO } from '../domain/photo.js';
import { listerPhotos, majAnnotationsPhoto } from '../storage/db.js';
import { illustration, svgCotesPhoto, traitParDefaut, versNormalise } from './dessin.js';
import { legendeCouleurs } from './guide.js';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const VUES = { exterieur: 'VUE EXTÉRIEURE', interieur: 'VUE INTÉRIEURE' };

// Si la photo n'est pas prise du même côté que les mesures, gauche et droite s'inversent sur la photo.
export const miroir = (t) => [1 - t[0], t[1], 1 - t[2], t[3]];
export function positionsParDefaut(produit, photo, pointDeVueMesure) {
  const inverser = !!(VUES[photo.categorie] && VUES[pointDeVueMesure] && photo.categorie !== pointDeVueMesure);
  const res = {};
  for (const c of produit.cotes) {
    const n = versNormalise(traitParDefaut(c, 300, 220), 300, 220);
    res[c.id] = inverser ? miroir(n) : n;
  }
  return { positions: res, inverser };
}

export async function monterPhotoCotes(conteneur, { produit, ouvrageId, valeurs, pointDeVue }) {
  let photos = [];
  let choisie = null; // id de la photo affichée
  let url = null;
  let annot = {};
  const libere = () => { if (url) URL.revokeObjectURL(url); url = null; };

  function photoAffichee() {
    const candidates = photos.filter((p) => VUES[p.categorie]);
    return photos.find((p) => p.id === choisie) || candidates.find((p) => p.categorie === pointDeVue()) || candidates[0] || null;
  }

  function structure() {
    libere();
    const p = photoAffichee();
    const types = [...new Set(produit.cotes.map((c) => c.type))];
    if (!p) {
      conteneur.innerHTML = `<div class="photo-cotes vide" data-test="photo-cotes-vide">
        <p><strong>📷 Prenez la photo de l’ouvrage</strong> (vue extérieure ou intérieure, section Photos) : les cotes saisies s’afficheront dessus.</p>
        <div id="pc-illus"></div>${legendeCouleurs(types)}</div>`;
      dessiner();
      return;
    }
    choisie = p.id;
    annot = { ...(p.annotations || {}) };
    url = URL.createObjectURL(new Blob([p.donnees], { type: p.type || 'image/jpeg' }));
    const autres = photos.filter((x) => VUES[x.categorie]);
    conteneur.innerHTML = `<div class="photo-cotes" data-test="photo-cotes">
      <div class="pc-cadre"><img src="${url}" alt="Photo de l’ouvrage" data-test="photo-cotes-img"><div class="pc-calque" id="pc-calque"></div></div>
      <div id="pc-inversion"></div>
      ${legendeCouleurs(types)}
      <p class="doux aide">Faites glisser les ronds aux extrémités pour placer chaque cote sur l’ouvrage.</p>
      <div class="actions">
        ${autres.length > 1 ? `<select id="pc-choix" aria-label="Photo affichée">${autres.map((x, i) => `<option value="${x.id}" ${x.id === p.id ? 'selected' : ''}>${esc(CATEGORIES_PHOTO[x.categorie])} ${i + 1}</option>`).join('')}</select>` : ''}
        <button type="button" class="btn secondaire" id="pc-reinit" data-test="pc-reinit">Replacer les cotes par défaut</button>
      </div>
      <div id="pc-msg"></div>
    </div>`;
    conteneur.querySelector('#pc-choix')?.addEventListener('change', (e) => { choisie = e.target.value; structure(); });
    conteneur.querySelector('#pc-reinit').onclick = async () => { annot = {}; dessiner(); await sauver(); };
    brancherGlisser();
    dessiner();
  }

  function dessiner() {
    const v = valeurs();
    const p = photoAffichee();
    if (!p) { const el = conteneur.querySelector('#pc-illus'); if (el) el.innerHTML = illustration(produit, v); return; }
    const { positions, inverser } = positionsParDefaut(produit, p, pointDeVue());
    const W = p.largeur || 1600, H = p.hauteur || 1200;
    conteneur.querySelector('#pc-calque').innerHTML = svgCotesPhoto(produit, W, H, v, { ...positions, ...annot }, { poignees: true, vue: VUES[p.categorie] });
    conteneur.querySelector('#pc-inversion').innerHTML = inverser
      ? `<div class="bandeau alerte" data-test="pc-inversion">Photo ${p.categorie === 'exterieur' ? 'extérieure' : 'intérieure'}, mesures prises depuis l’${pointDeVue() === 'interieur' ? 'intérieur' : 'extérieur'} : <strong>gauche et droite sont inversées sur la photo</strong> (H1 « gauche » apparaît à droite).</div>` : '';
  }

  async function sauver() {
    const p = photoAffichee();
    if (!p) return;
    try {
      await majAnnotationsPhoto(p.id, annot);
      p.annotations = { ...annot };
    } catch (e) {
      conteneur.querySelector('#pc-msg').innerHTML = `<div class="bandeau erreur" role="alert">Position non enregistrée : ${esc(e?.message || e)}</div>`;
    }
  }

  function brancherGlisser() {
    const calque = conteneur.querySelector('#pc-calque');
    let prise = null;
    calque.addEventListener('pointerdown', (e) => {
      const rond = e.target.closest('.poignee');
      if (!rond) return;
      e.preventDefault();
      const svg = calque.querySelector('svg');
      const id = rond.closest('[data-cote]').dataset.cote;
      const p = photoAffichee();
      const { positions } = positionsParDefaut(produit, p, pointDeVue());
      prise = { id, bout: Number(rond.dataset.bout), svg, depart: annot[id] || positions[id] };
      calque.setPointerCapture?.(e.pointerId);
    });
    calque.addEventListener('pointermove', (e) => {
      if (!prise) return;
      const r = prise.svg.getBoundingClientRect();
      const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
      const t = [...(annot[prise.id] || prise.depart)];
      if (prise.bout === 1) { t[0] = x; t[1] = y; } else { t[2] = x; t[3] = y; }
      annot[prise.id] = t;
      dessiner();
      prise.svg = conteneur.querySelector('#pc-calque svg');
    });
    const fin = async () => { if (!prise) return; prise = null; await sauver(); };
    calque.addEventListener('pointerup', fin);
    calque.addEventListener('pointercancel', fin);
  }

  async function recharger() {
    photos = await listerPhotos(ouvrageId);
    if (choisie && !photos.some((p) => p.id === choisie)) choisie = null;
    structure();
  }

  window.addEventListener('hashchange', libere, { once: true });
  await recharger();
  return { rafraichir: dessiner, recharger };
}
