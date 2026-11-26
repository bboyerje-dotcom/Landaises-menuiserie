// Document « Relevé de chantier » (impression / PDF) et export tableur pour ProDevis.
import {
  TYPOLOGIES, OUVERTURES, MATERIAUX, TYPES_POSE, POINTS_DE_VUE, REFERENCES_MESURE, ETATS_DORMANT, SENS, STATUTS_OUVRAGE, trierParRepere,
} from '../domain/ouvrage.js';
import { TYPES_CHANTIER, NATURES_BATIMENT } from '../domain/dossier.js';
import { CATEGORIES_PHOTO } from '../domain/photo.js';
import { versCsv, lignesExport, nomFichier } from '../domain/export.js';
import { COLONNES_PRODEVIS } from '../config/export-prodevis.js';
import { REGLES } from '../config/regles.js';
import { lireDossier, listerOuvrages, listerPhotos } from '../storage/db.js';
import { pictoSens } from './ouvrage.js';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const lib = (dico, v) => dico[v] || '—';
const mm = (v) => (v == null ? '—' : String(v));
const dateFr = (iso) => (iso ? new Date(iso.length === 10 ? iso + 'T12:00:00' : iso).toLocaleDateString('fr-FR') : '—');
const heureFr = (d) => d.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });

let urlsActives = [];
const liberer = () => { urlsActives.forEach((u) => URL.revokeObjectURL(u)); urlsActives = []; };
window.addEventListener('hashchange', liberer);

function telecharger(contenu, type, nom) {
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([contenu], { type })), download: nom });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function ficheOuvrage(o, photos) {
  const L = (k, v) => `<tr><th>${k}</th><td>${esc(v) || '—'}</td></tr>`;
  const ouvrant = o.typeOuverture !== 'fixe';
  return `<section class="fiche" data-test="fiche-ouvrage">
    <div class="fiche-titre"><h2>${esc(o.repere)} · ${esc(lib(TYPOLOGIES, o.typologie))} — ${esc(o.localisation || 'localisation ?')}${o.niveau ? ` (${esc(o.niveau)})` : ''}</h2>
      <span class="statut ${o.statut === 'complet' ? 'ok' : 'alerte'}">${esc(STATUTS_OUVRAGE[o.statut])}</span></div>
    <p class="doux">Relevé version ${o.version} du ${dateFr(o.modifieLe)}</p>
    ${o.pointsAVerifier?.length ? `<div class="a-verifier"><strong>Points à vérifier :</strong><ul>${o.pointsAVerifier.map((p) => `<li>${esc(p)}</li>`).join('')}</ul></div>` : ''}
    <div class="col2">
      <table class="kv"><caption>Pose</caption>
        ${L('Type de pose', lib(TYPES_POSE, o.typePose))}
        ${L('Confirmée par le client', o.poseConfirmee ? `Oui, le ${dateFr(o.poseConfirmeeLe)}` : 'NON')}
        ${o.typePose === 'renovation' ? L('État du dormant', lib(ETATS_DORMANT, o.etatDormant)) : ''}
        ${o.hesitationPose ? L('Client hésitant', `Tableau : L ${mm(o.alt?.largeur)} × H ${mm(o.alt?.hauteur)} mm`) : ''}
      </table>
      <table class="kv"><caption>Configuration</caption>
        ${L('Matériau', lib(MATERIAUX, o.materiau))}
        ${L('Ouverture', `${lib(OUVERTURES, o.typeOuverture)}${o.nbVantaux ? `, ${o.nbVantaux} ${o.nbVantaux > 1 ? 'vantaux' : 'vantail'}` : ''}`)}
        ${L('Coloris int. / ext.', `${o.colorisInt || '—'} / ${o.colorisExt || '—'}`)}
        ${L('Vitrage', o.vitrage)}
      </table>
    </div>
    <table class="mesures"><caption>Mesures en mm — prises ${esc(lib(REFERENCES_MESURE, o.referenceMesure).toLowerCase())}, depuis l’${esc(lib(POINTS_DE_VUE, o.pointDeVueMesure).toLowerCase())}</caption>
      <thead><tr><th></th><th>1</th><th>2</th><th>3</th><th>Retenue</th></tr></thead>
      <tbody>
        <tr><th>Largeur (haut / milieu / bas)</th>${(o.largeurs || []).map((v) => `<td>${mm(v)}</td>`).join('')}<td class="retenue">${mm(o.largeurRetenue)}</td></tr>
        <tr><th>Hauteur (gauche / milieu / droite)</th>${(o.hauteurs || []).map((v) => `<td>${mm(v)}</td>`).join('')}<td class="retenue">${mm(o.hauteurRetenue)}</td></tr>
        <tr><th>Diagonales D1 / D2</th><td>${mm(o.diagonales?.[0])}</td><td>${mm(o.diagonales?.[1])}</td><td></td><td></td></tr>
      </tbody>
    </table>
    <div class="col2">
      <div><strong>Sens d’ouverture (vu de l’intérieur)</strong>
        ${ouvrant && o.sens ? `<div class="picto-doc">${pictoSens(o.sens, o.nbVantaux || 1)}</div><div>${o.nbVantaux >= 2 ? 'Vantail de service : ' : 'Paumelles à '}${esc(lib(SENS, o.sens).toLowerCase())}</div>` : `<p>${ouvrant ? 'NON RENSEIGNÉ' : 'Sans objet (fixe)'}</p>`}
      </div>
      <div><strong>Observations</strong><p class="obs">${esc(o.observations) || '—'}</p></div>
    </div>
    ${photos.length ? `<div class="photos-doc">${photos.map((p) => `<figure><img data-photo="${p.id}" alt="${esc(CATEGORIES_PHOTO[p.categorie])}">
      <figcaption><strong>${esc(CATEGORIES_PHOTO[p.categorie])}</strong>${p.legende ? ` — ${esc(p.legende)}` : ''}</figcaption></figure>`).join('')}</div>` : '<p class="doux">Aucune photo.</p>'}
  </section>`;
}

export async function ecranReleve(app, dossierId) {
  liberer();
  const d = await lireDossier(dossierId);
  if (!d) {
    app.innerHTML = `<div class="bandeau erreur" role="alert">Dossier introuvable sur cet appareil.</div><a class="btn" href="#/">Retour</a>`;
    return;
  }
  const ouvrages = (await listerOuvrages(d.id)).sort(trierParRepere);
  const photosPar = Object.fromEntries(await Promise.all(ouvrages.map(async (o) => [o.id, await listerPhotos(o.id)])));
  const nbAV = ouvrages.filter((o) => o.statut !== 'complet').length;
  const edition = new Date();

  app.innerHTML = `
    <div class="no-print">
      <p class="doux"><a href="#/dossier/${encodeURIComponent(d.id)}">← Retour au dossier</a></p>
      ${!ouvrages.length ? '<div class="bandeau alerte" data-test="aucun-ouvrage">Aucun ouvrage relevé : le document ne contient que la fiche client.</div>' : ''}
      ${nbAV ? `<div class="bandeau alerte" data-test="alerte-a-verifier"><strong>${nbAV} ouvrage${nbAV > 1 ? 's' : ''} À VÉRIFIER.</strong> Le document et l’export l’indiquent clairement.</div>` : ''}
      <div class="actions">
        <button class="btn" id="imprimer" disabled data-test="imprimer">Chargement des photos…</button>
        <button class="btn secondaire" id="export-csv" ${ouvrages.length ? '' : 'disabled'} data-test="export-csv">Export ProDevis (Excel)</button>
      </div>
      <p class="doux">PDF : bouton « Imprimer / PDF », puis choisir « Enregistrer au format PDF » comme imprimante.</p>
      <div id="msg-releve"></div>
    </div>
    <article class="doc" data-test="document">
      <header class="doc-entete">
        <div><strong class="societe">Landaise de Menuiserie</strong><br>Relevé de chantier</div>
        <div class="doc-ref"><strong>${esc(d.reference)}</strong><br>Édité le ${heureFr(edition)}</div>
      </header>
      <p class="avert" data-test="avertissement">Document de relevé. Les cotes indiquées sont des cotes <strong>mesurées</strong> : elles ne sont ni des cotes de fabrication, ni une commande. Validation technique obligatoire avant toute fabrication.${REGLES.valide ? '' : ' Seuils de contrôle provisoires (non validés).'}</p>
      <section class="col2">
        <table class="kv"><caption>Client</caption>
          <tr><th>Nom</th><td>${esc(d.clientNom)}</td></tr>
          <tr><th>Téléphone</th><td>${esc(d.telephone.replace(/(\d{2})(?=\d)/g, '$1 '))}</td></tr>
          <tr><th>E-mail</th><td>${esc(d.email) || '—'}</td></tr>
        </table>
        <table class="kv"><caption>Chantier</caption>
          <tr><th>Adresse</th><td>${esc(d.adresse)}<br>${esc(d.codePostal)} ${esc(d.commune)}</td></tr>
          <tr><th>Type</th><td>${esc(TYPES_CHANTIER[d.typeChantier])} · ${esc(NATURES_BATIMENT[d.natureBatiment])}</td></tr>
          <tr><th>Relevé par</th><td>${esc(d.responsable)}, le ${dateFr(d.dateRdv)}</td></tr>
        </table>
      </section>
      ${d.description || d.contraintes ? `<table class="kv large"><tr><th>Projet</th><td>${esc(d.description) || '—'}</td></tr><tr><th>Contraintes</th><td>${esc(d.contraintes) || '—'}</td></tr></table>` : ''}
      ${ouvrages.length ? `<table class="synthese" data-test="synthese"><caption>Synthèse : ${ouvrages.length} ouvrage${ouvrages.length > 1 ? 's' : ''}, dont ${nbAV} à vérifier</caption>
        <thead><tr><th>Repère</th><th>Ouvrage</th><th>Pièce</th><th>L × H retenues (mm)</th><th>Pose</th><th>Statut</th></tr></thead>
        <tbody>${ouvrages.map((o) => `<tr><td>${esc(o.repere)}</td><td>${esc(lib(TYPOLOGIES, o.typologie))}</td><td>${esc(o.localisation)}</td>
          <td>${mm(o.largeurRetenue)} × ${mm(o.hauteurRetenue)}</td><td>${esc(lib(TYPES_POSE, o.typePose))}</td>
          <td class="${o.statut === 'complet' ? 'ok' : 'alerte'}">${esc(STATUTS_OUVRAGE[o.statut])}</td></tr>`).join('')}</tbody></table>` : ''}
      ${ouvrages.map((o) => ficheOuvrage(o, photosPar[o.id])).join('')}
      <section class="validation">
        <strong>Validation technique</strong> (personne habilitée)
        <div class="cases"><div>Nom :</div><div>Date :</div><div>Signature :</div></div>
      </section>
      <footer class="doc-pied">${esc(d.reference)} — généré par Pilotage Terrain le ${heureFr(edition)} — relevé indicatif, cotes de fabrication à établir par le bureau.</footer>
    </article>`;

  // Photos : chargées puis décodées avant d'autoriser l'impression (sinon pages blanches).
  const toutes = Object.values(photosPar).flat();
  await Promise.allSettled([...app.querySelectorAll('img[data-photo]')].map(async (img) => {
    const p = toutes.find((x) => x.id === img.dataset.photo);
    try {
      const u = URL.createObjectURL(new Blob([p.donnees], { type: p.type || 'image/jpeg' }));
      urlsActives.push(u);
      img.src = u;
      await img.decode();
    } catch {
      img.replaceWith(Object.assign(document.createElement('div'), { className: 'photo-illisible', textContent: 'Photo illisible' }));
    }
  }));
  const btnImp = document.getElementById('imprimer');
  if (!btnImp) return; // l'utilisateur a quitté l'écran entre-temps
  btnImp.disabled = false;
  btnImp.textContent = 'Imprimer / PDF';
  btnImp.onclick = () => window.print();

  let enCours = false;
  document.getElementById('export-csv').onclick = () => {
    if (enCours) return;
    enCours = true;
    try {
      const extras = Object.fromEntries(ouvrages.map((o) => [o.id, { nbPhotos: photosPar[o.id].length }]));
      const { entetes, lignes } = lignesExport(COLONNES_PRODEVIS, d, ouvrages, extras);
      telecharger(versCsv(entetes, lignes), 'text/csv;charset=utf-8', nomFichier(d, 'export-prodevis', 'csv'));
      document.getElementById('msg-releve').innerHTML = `<div class="bandeau ok" role="status" data-test="export-ok">Export généré : ${ouvrages.length} ligne${ouvrages.length > 1 ? 's' : ''}${nbAV ? `, dont ${nbAV} À VÉRIFIER` : ''}.</div>`;
    } catch (e) {
      document.getElementById('msg-releve').innerHTML = `<div class="bandeau erreur" role="alert">Export impossible : ${esc(e?.message || e)}</div>`;
    } finally {
      setTimeout(() => { enCours = false; }, 800);
    }
  };
}
