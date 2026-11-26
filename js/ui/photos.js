// Bloc « Photos » de l'écran ouvrage : prise de vue, galerie, miniatures, visionneuse.
import { CATEGORIES_PHOTO, PHOTOS_OBLIGATOIRES, empreinteContenu, verifierFichier } from '../domain/photo.js';
import { nouvelId } from '../domain/dossier.js';
import { compresserPhoto } from '../media/image.js';
import { ajouterPhoto, listerPhotos, supprimerPhoto, majLegendePhoto, espaceStockage } from '../storage/db.js';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ESPACE_MIN_OCTETS = 5 * 1024 * 1024;

export async function monterPhotos(conteneur, { dossierId, ouvrageId, onChange }) {
  let photos = [];
  let urls = [];
  let occupe = false;

  const liberer = () => { urls.forEach((u) => URL.revokeObjectURL(u)); urls = []; };
  const url = (buf) => { const u = URL.createObjectURL(new Blob([buf], { type: 'image/jpeg' })); urls.push(u); return u; };
  const message = (html, type = 'erreur') => {
    conteneur.querySelector('#photos-msg').innerHTML = html ? `<div class="bandeau ${type}" role="${type === 'erreur' ? 'alert' : 'status'}" data-test="photos-msg">${html}</div>` : '';
  };

  function rendre() {
    liberer();
    conteneur.innerHTML = `
      <div id="photos-msg"></div>
      ${Object.entries(CATEGORIES_PHOTO).map(([cat, libelle]) => {
        const liste = photos.filter((p) => p.categorie === cat);
        return `<div class="cat-photo" data-cat="${cat}">
          <div class="ligne"><strong>${esc(libelle)}${PHOTOS_OBLIGATOIRES.includes(cat) ? ' <span class="obl" aria-hidden="true">*</span>' : ''}</strong>
            <span class="doux" data-test="nb-${cat}">${liste.length} photo${liste.length > 1 ? 's' : ''}</span></div>
          <div class="boutons-photo">
            <label class="btn secondaire"><input type="file" accept="image/*" capture="environment" data-cat="${cat}" data-test="camera-${cat}" hidden ${occupe ? 'disabled' : ''}>📷 Prendre</label>
            <label class="btn secondaire"><input type="file" accept="image/*" multiple data-cat="${cat}" data-test="galerie-${cat}" hidden ${occupe ? 'disabled' : ''}>Galerie</label>
          </div>
          <div class="miniatures">${liste.map((p) => `<button type="button" class="mini" data-id="${p.id}" data-test="mini" aria-label="Ouvrir la photo ${esc(p.legende || libelle)}">
            <img src="${url(p.miniature)}" alt="">${p.legende ? `<span>${esc(p.legende)}</span>` : ''}</button>`).join('')}</div>
        </div>`;
      }).join('')}
      <dialog id="visionneuse" class="visionneuse">
        <img id="vis-img" alt="">
        <label for="vis-legende">Légende</label>
        <input id="vis-legende" type="text" maxlength="120" placeholder="ex. appui fissuré côté gauche">
        <div class="actions">
          <button type="button" class="btn" id="vis-enregistrer">Enregistrer la légende</button>
          <button type="button" class="btn secondaire" id="vis-supprimer" data-test="supprimer-photo">Supprimer</button>
          <button type="button" class="btn secondaire" id="vis-fermer">Fermer</button>
        </div>
      </dialog>`;
    if (occupe) message('Traitement de la photo…', 'alerte');

    conteneur.querySelectorAll('input[type=file]').forEach((inp) => inp.addEventListener('change', async () => {
      const fichiers = [...inp.files];
      inp.value = ''; // permet de re-sélectionner le même fichier (le doublon sera alors signalé)
      await traiter(inp.dataset.cat, fichiers);
    }));
    conteneur.querySelectorAll('.mini').forEach((b) => b.addEventListener('click', () => ouvrir(b.dataset.id)));
  }

  async function recharger() {
    photos = await listerPhotos(ouvrageId);
    rendre();
    // On attend la mise à jour du formulaire (statut, cotes sur photo) avant d'afficher
    // « photo enregistrée » : le message signifie que tout est à jour. Une erreur côté
    // formulaire ne doit pas empêcher le message.
    try { await onChange?.([...new Set(photos.map((p) => p.categorie))], photos.length); } catch (e) { console.error(e); }
  }

  async function traiter(categorie, fichiers) {
    if (occupe || !fichiers.length) return; // anti double traitement
    occupe = true;
    rendre();
    const erreurs = [];
    let ajoutees = 0;
    for (const f of fichiers) {
      const nom = esc(f.name || 'photo');
      const invalide = verifierFichier(f);
      if (invalide) { erreurs.push(`${nom} : ${esc(invalide)}`); continue; }
      try {
        const { libre } = await espaceStockage();
        if (libre != null && libre < ESPACE_MIN_OCTETS) throw new Error('Espace de stockage presque plein sur cet appareil. Exportez une sauvegarde puis libérez de l’espace.');
        const empreinte = empreinteContenu(new Uint8Array(await f.arrayBuffer()));
        const c = await compresserPhoto(f);
        await ajouterPhoto({
          id: nouvelId(), ouvrageId, dossierId, categorie, legende: '', empreinte,
          creeLe: new Date().toISOString(), ...c,
        });
        ajoutees++;
      } catch (e) {
        console.error(e);
        const txt = e?.name === 'QuotaExceededError' ? 'espace de stockage plein sur cet appareil.' : e?.message || String(e);
        erreurs.push(`${nom} : ${esc(txt)}`);
      }
    }
    occupe = false;
    await recharger();
    if (erreurs.length) message(`<strong>${erreurs.length} photo${erreurs.length > 1 ? 's' : ''} non ajoutée${erreurs.length > 1 ? 's' : ''}</strong><ul>${erreurs.map((x) => `<li>${x}</li>`).join('')}</ul>`);
    else if (ajoutees) message(`${ajoutees} photo${ajoutees > 1 ? 's' : ''} enregistrée${ajoutees > 1 ? 's' : ''} sur l’appareil.`, 'ok');
  }

  function ouvrir(id) {
    const p = photos.find((x) => x.id === id);
    if (!p) return;
    const dlg = conteneur.querySelector('#visionneuse');
    conteneur.querySelector('#vis-img').src = url(p.donnees);
    conteneur.querySelector('#vis-legende').value = p.legende || '';
    conteneur.querySelector('#vis-enregistrer').onclick = async () => {
      try {
        await majLegendePhoto(id, conteneur.querySelector('#vis-legende').value.trim());
        dlg.close();
        await recharger();
      } catch (e) { dlg.close(); message(`Légende non enregistrée : ${esc(e?.message || e)}`); }
    };
    conteneur.querySelector('#vis-supprimer').onclick = async () => {
      if (!confirm('Supprimer définitivement cette photo ?')) return;
      try {
        await supprimerPhoto(id);
        dlg.close();
        await recharger();
        message('Photo supprimée.', 'ok');
      } catch (e) { dlg.close(); message(`Suppression impossible : ${esc(e?.message || e)}`); }
    };
    conteneur.querySelector('#vis-fermer').onclick = () => dlg.close();
    dlg.showModal();
  }

  await recharger();
  return { categories: () => [...new Set(photos.map((p) => p.categorie))], enCours: () => occupe };
}
