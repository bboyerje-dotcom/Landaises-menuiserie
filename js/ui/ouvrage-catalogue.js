// Relevé guidé générique d'un produit du catalogue :
// produit → photo (affichée tout de suite) → tableau de métrage → cotes dessinées sur la photo.
import { normaliserOuvrageCatalogue, analyserOuvrageCatalogue, optionVisible, penteDegres } from '../domain/catalogue.js';
import { nouvelId } from '../domain/dossier.js';
import { STATUTS_OUVRAGE } from '../domain/ouvrage.js';
import { TYPES_COTE, couleurCote } from '../catalogue/types-cotes.js';
import { REGLES } from '../config/regles.js';
import {
  lireDossier, lireOuvrage, listerOuvrages, enregistrerOuvrage, majStatutOuvrage, supprimerPhotosOuvrage,
  lireBrouillon, ecrireBrouillon, effacerBrouillon,
} from '../storage/db.js';
import { monterPhotos } from './photos.js';
import { monterPhotoCotes } from './photo-cotes.js';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const mm = (v) => (v == null ? '—' : `${v} mm`);
const cleBrouillon = (dossierId, ouvrageId, produitId) => `pt.brouillon.ouvrage.${dossierId}.${ouvrageId || 'nouveau-' + produitId}`;

export function prochainRepereCatalogue(prefixe, autres) {
  const pris = new Set(autres.map((x) => x.repere));
  let n = 1;
  while (pris.has(prefixe + n)) n++;
  return prefixe + n;
}

// Valeurs de formulaire depuis un ouvrage enregistré.
function valeursDepuis(o, p) {
  const v = { repere: o.repere, localisation: o.localisation, niveau: o.niveau, quantite: String(o.quantite || 1), pointDeVueMesure: o.pointDeVueMesure,
    typePose: o.typePose, poseConfirmee: o.poseConfirmee, observations: o.observations };
  for (const c of p.cotes) v['cote_' + c.id] = o.cotes?.[c.id] ?? '';
  for (const op of p.options || []) v['opt_' + op.id] = o.options?.[op.id] ?? '';
  return v;
}

const radios = (nom, legende, options, { obl = true } = {}) => `
  <fieldset data-champ="${nom}"><legend>${esc(legende)}${obl ? ' <span class="obl" aria-hidden="true">*</span>' : ''}</legend>
    <div class="choix">${Object.entries(options).map(([v, l]) => `<label><input type="radio" name="${nom}" value="${v}"> ${esc(l)}</label>`).join('')}</div>
    <div class="msg-champ" id="err-${nom}"></div></fieldset>`;

function ligneCote(c) {
  const deg = c.unite === 'deg';
  return `<tr data-champ="cote_${c.id}">
    <td><span class="code" style="--c:${couleurCote(c.type)}">${esc(c.code)}</span></td>
    <td class="lib">${esc(c.libelle)}${c.obligatoire ? ' <span class="obl" aria-hidden="true">*</span>' : ''}<small>${esc(TYPES_COTE[c.type].libelle)}</small>
      <div class="msg-champ" id="err-cote_${c.id}"></div>
      ${deg ? `<details class="calc"><summary>Calculer depuis un dénivelé</summary><div class="calc-pente">
        <label>Dénivelé (mm)<input type="text" inputmode="numeric" data-calc="d" data-pour="${c.id}"></label>
        <label>Longueur (mm)<input type="text" inputmode="numeric" data-calc="l" data-pour="${c.id}"></label>
        <button type="button" class="btn secondaire" data-calculer="${c.id}">= °</button></div></details>` : ''}</td>
    <td class="val"><div class="mm"><input id="cote_${c.id}" name="cote_${c.id}" type="text" inputmode="${deg ? 'decimal' : 'numeric'}" autocomplete="off" aria-label="${esc(c.code + ' ' + c.libelle)}"><span class="unite">${deg ? '°' : 'mm'}</span></div></td>
  </tr>`;
}

export async function ecranOuvrageCatalogue(app, dossierId, ouvrageId, p) {
  const dossier = await lireDossier(dossierId);
  if (!dossier) { app.innerHTML = `<div class="bandeau erreur" role="alert">Dossier introuvable sur cet appareil.</div><a class="btn" href="#/">Retour</a>`; return; }
  const existant = ouvrageId ? await lireOuvrage(ouvrageId) : null;
  if (ouvrageId && (!existant || existant.dossierId !== dossierId)) { app.innerHTML = `<div class="bandeau erreur" role="alert">Ouvrage introuvable.</div><a class="btn" href="#/dossier/${encodeURIComponent(dossierId)}">Retour</a>`; return; }
  const cle = cleBrouillon(dossierId, ouvrageId, p.id);
  let brouillon = lireBrouillon(cle);
  const restaure = !!brouillon?.valeurs;
  if (!brouillon) brouillon = { id: existant?.id || nouvelId(), valeurs: existant ? valeursDepuis(existant, p) : {}, debut: null };
  const autres = await listerOuvrages(dossierId);
  if (!existant && !brouillon.valeurs.repere) brouillon.valeurs.repere = prochainRepereCatalogue(p.prefixe, autres);
  if (!brouillon.valeurs.quantite) brouillon.valeurs.quantite = '1';

  const groupes = Object.keys(TYPES_COTE).filter((t) => p.cotes.some((c) => c.type === t));
  app.innerHTML = `
    <p class="doux"><a href="#/dossier/${encodeURIComponent(dossierId)}">← ${esc(dossier.reference)} · ${esc(dossier.clientNom)}</a></p>
    <h1>${esc(p.libelle)} ${existant ? `<span class="doux">${esc(existant.repere)} · v${existant.version}</span>` : ''}</h1>
    ${restaure ? `<div class="bandeau alerte" data-test="brouillon-restaure">Modifications non enregistrées restaurées.
      <button type="button" class="btn secondaire" id="jeter-c">Annuler ces modifications</button></div>` : ''}
    <p class="doux">${esc(p.aide || '')}</p>
    <form id="fc" novalidate autocomplete="off">
      <h2>1. Identification</h2>
      <div class="deux">
        <div><label for="repere">Repère <span class="obl">*</span></label><input id="repere" name="repere" maxlength="10" autocapitalize="characters"><div class="msg-champ" id="err-repere"></div></div>
        <div><label for="localisation">Localisation <span class="obl">*</span></label><input id="localisation" name="localisation" list="lieux"><div class="msg-champ" id="err-localisation"></div></div>
      </div>
      <datalist id="lieux"><option>Séjour</option><option>Cuisine</option><option>Chambre 1</option><option>Chambre 2</option><option>Entrée</option><option>Garage</option><option>Terrasse</option><option>Façade principale</option><option>Jardin</option></datalist>
      <div class="deux egal">
        <div><label for="niveau">Niveau</label><input id="niveau" name="niveau" placeholder="RDC, R+1…"></div>
        <div><label for="quantite">Quantité</label><input id="quantite" name="quantite" type="number" min="1" inputmode="numeric"></div>
      </div>

      <h2>2. Photo de l’ouvrage</h2>
      <div id="photos-bloc"></div>

      <div class="zone-mesures">
      <div id="photo-cotes" class="pc-collant"></div>
      <h2>3. Mesures</h2>
      ${radios('pointDeVueMesure', 'Mesures prises depuis', { interieur: 'Intérieur', exterieur: 'Extérieur' })}
      ${p.poses ? radios('typePose', 'Type de pose', p.poses) + `<div class="case" data-si-pose><label><input type="checkbox" name="poseConfirmee" id="poseConfirmee"> <span>Type de pose <strong>confirmé par le client</strong></span></label></div>` : ''}
      ${groupes.map((t) => `<h3 class="titre-groupe"><span class="pastille" style="background:${couleurCote(t)}"></span> ${esc(TYPES_COTE[t].libelle)}</h3>
        <table class="metrage"><tbody>${p.cotes.filter((c) => c.type === t).map(ligneCote).join('')}</tbody></table>`).join('')}
      <div class="retenues" id="retenues" data-test="retenues"></div>
      <div id="calcul" data-test="calcul"></div>
      </div>

      ${(p.options || []).length ? `<h2>4. Options</h2>${p.options.map((op) => `<div data-option="${op.id}">${radios('opt_' + op.id, op.libelle, op.choix, { obl: op.obligatoire })}</div>`).join('')}` : ''}
      <label for="observations">Observations</label>
      <textarea id="observations" name="observations"></textarea>

      <div id="apercu" class="apercu" aria-live="polite" data-test="apercu"></div>
      <div id="bandeau-c"></div>
      <div class="actions"><button class="btn plein" type="submit" id="enregistrer-ouvrage">Enregistrer l’ouvrage</button></div>
    </form>
    <a class="btn secondaire plein" href="#/dossier/${encodeURIComponent(dossierId)}">Retour au dossier</a>`;

  const f = document.getElementById('fc');
  const btn = document.getElementById('enregistrer-ouvrage');
  // Remplissage
  for (const [k, v] of Object.entries(brouillon.valeurs)) {
    const el = f.elements[k];
    if (!el) continue;
    if (el instanceof RadioNodeList) el.forEach((r) => { r.checked = r.value === String(v); });
    else if (el.type === 'checkbox') el.checked = v === true;
    else el.value = v ?? '';
  }

  const lire = () => {
    const o = {};
    for (const el of f.elements) {
      if (!el.name || el.closest('[hidden]')) continue;
      if (el.type === 'radio') { if (el.checked) o[el.name] = el.value; else o[el.name] ??= ''; }
      else if (el.type === 'checkbox') o[el.name] = el.checked;
      else o[el.name] = el.value;
    }
    return o;
  };
  let catPhotos = [];
  const normaliser = () => normaliserOuvrageCatalogue({ ...lire(), id: brouillon.id, dossierId }, p);
  const analyser = (o = normaliser()) => analyserOuvrageCatalogue(o, p, { regles: REGLES, autres, photos: catPhotos });

  let photoCotes = null;
  const majEcran = () => {
    const opts = Object.fromEntries((p.options || []).map((op) => [op.id, f.querySelector(`[name="opt_${op.id}"]:checked`)?.value || '']));
    for (const op of p.options || []) f.querySelector(`[data-option="${op.id}"]`).hidden = !optionVisible(op, opts);
    const pose = f.querySelector('[data-si-pose]');
    if (pose) pose.hidden = !f.querySelector('[name="typePose"]:checked');
    const o = normaliser();
    const a = analyser(o);
    document.getElementById('retenues').innerHTML = `Cotes retenues (plus petite mesure) : <strong>L ${mm(a.largeurRetenue)}</strong> × <strong>H ${mm(a.hauteurRetenue)}</strong>`;
    document.getElementById('calcul').innerHTML = a.calcul?.lignes?.length
      ? `<div class="carte calcul"><strong>Calcul indicatif (abaque interne)</strong><table class="kv-simple">${a.calcul.lignes.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</table>
         <p class="doux">Ne vaut pas cote de commande : à valider avant commande du vitrage.</p></div>` : '';
    const pts = [...a.manquants, ...a.alertes].map((x) => x.msg);
    document.getElementById('apercu').innerHTML = a.statut === 'complet'
      ? `<div class="bandeau ok">Statut à l’enregistrement : <strong>COMPLET</strong></div>`
      : `<div class="bandeau alerte">Statut à l’enregistrement : <strong>À VÉRIFIER</strong> (${pts.length} point${pts.length > 1 ? 's' : ''})<ul>${pts.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>`;
    photoCotes?.rafraichir();
  };

  const valeursCotes = () => {
    const o = normaliser();
    return Object.fromEntries(Object.entries(o.cotes).filter(([, v]) => v != null && !Number.isNaN(v)));
  };
  photoCotes = await monterPhotoCotes(document.getElementById('photo-cotes'), {
    produit: p, ouvrageId: brouillon.id, valeurs: valeursCotes,
    pointDeVue: () => f.querySelector('[name="pointDeVueMesure"]:checked')?.value || '',
  });

  let premier = true;
  const blocPhotos = await monterPhotos(document.getElementById('photos-bloc'), {
    dossierId, ouvrageId: brouillon.id,
    onChange: async (categories, nb) => {
      catPhotos = categories;
      if (premier) { premier = false; majEcran(); return; }
      ecrireBrouillon(brouillon, cle);
      // 1. Statut en base d'abord : il doit être juste même si l'écran a été quitté entre-temps.
      const enBase = await lireOuvrage(brouillon.id);
      if (enBase) {
        const a = analyserOuvrageCatalogue(enBase, p, { regles: REGLES, autres, photos: categories });
        await majStatutOuvrage(enBase.id, { statut: a.statut, pointsAVerifier: [...a.manquants, ...a.alertes].map((x) => x.msg) }, `photos modifiées (${nb} au total)`);
      }
      // 2. Écran ensuite, seulement s'il est toujours affiché.
      if (!f.isConnected) return;
      await photoCotes.recharger();
      majEcran();
    },
  });

  document.getElementById('jeter-c')?.addEventListener('click', async () => {
    if (!existant && !(await lireOuvrage(brouillon.id))) await supprimerPhotosOuvrage(brouillon.id);
    effacerBrouillon(cle);
    ecranOuvrageCatalogue(app, dossierId, ouvrageId, p);
  });
  // Changer le type de pose annule la confirmation client : brouillon et aperçu mis à jour aussitôt.
  f.elements.typePose?.forEach?.((r) => r.addEventListener('change', () => {
    f.elements.poseConfirmee.checked = false;
    brouillon.valeurs = lire();
    ecrireBrouillon(brouillon, cle);
    majEcran();
  }));
  f.querySelectorAll('[data-calculer]').forEach((b) => b.addEventListener('click', () => {
    const id = b.dataset.calculer;
    const val = (k) => Number(f.querySelector(`[data-calc="${k}"][data-pour="${id}"]`).value.replace(/\s/g, ''));
    const deg = penteDegres(val('d'), val('l'));
    if (deg == null) { document.getElementById('err-cote_' + id).textContent = 'Saisissez un dénivelé et une longueur en mm.'; return; }
    f.elements['cote_' + id].value = String(deg).replace('.', ',');
    f.elements['cote_' + id].dispatchEvent(new Event('input', { bubbles: true }));
  }));

  majEcran();
  let enCours = false;
  f.addEventListener('input', (e) => {
    if (e.target.dataset.calc) return;
    if (!brouillon.debut) brouillon.debut = new Date().toISOString();
    brouillon.valeurs = lire();
    ecrireBrouillon(brouillon, cle);
    const err = document.getElementById('err-' + e.target.name);
    if (err) err.textContent = '';
    e.target.removeAttribute?.('aria-invalid');
    majEcran();
  });

  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (enCours) return;
    const bandeau = document.getElementById('bandeau-c');
    bandeau.innerHTML = '';
    if (blocPhotos.enCours()) {
      bandeau.innerHTML = '<div class="bandeau alerte" role="alert" data-test="photo-en-cours">Photo en cours de traitement : patientez quelques secondes puis enregistrez.</div>';
      return;
    }
    f.querySelectorAll('.msg-champ').forEach((x) => { x.textContent = ''; });
    f.querySelectorAll('[aria-invalid]').forEach((x) => x.removeAttribute('aria-invalid'));
    const o = normaliser();
    const a = analyser(o);
    if (!a.valideEnregistrement) {
      for (const [k, m] of Object.entries(a.erreurs)) {
        const el = document.getElementById('err-' + k);
        if (el) el.textContent = m;
        f.querySelectorAll(`[name="${k}"]`).forEach((x) => x.setAttribute('aria-invalid', 'true'));
      }
      bandeau.innerHTML = `<div class="bandeau erreur" role="alert" data-test="erreurs-ouvrage"><strong>À corriger avant d’enregistrer :</strong>
        <ul>${Object.values(a.erreurs).map((m) => `<li>${esc(m)}</li>`).join('')}</ul></div>`;
      const premierErr = f.querySelector('[aria-invalid="true"]');
      premierErr?.focus();
      premierErr?.scrollIntoView({ block: 'center' });
      return;
    }
    enCours = true;
    btn.disabled = true;
    btn.textContent = 'Enregistrement…';
    try {
      const fin = new Date();
      const confirmeAvant = existant?.poseConfirmee && existant.typePose === o.typePose;
      await enregistrerOuvrage({
        ...o,
        poseConfirmeeLe: o.poseConfirmee ? (confirmeAvant ? existant.poseConfirmeeLe : fin.toISOString()) : null,
        statut: a.statut, pointsAVerifier: [...a.manquants, ...a.alertes].map((x) => x.msg),
        largeurRetenue: a.largeurRetenue, hauteurRetenue: a.hauteurRetenue, reglesValidees: REGLES.valide, calcul: a.calcul,
      }, { dureeSec: brouillon.debut ? (fin - new Date(brouillon.debut)) / 1000 : 0, maintenant: fin });
      effacerBrouillon(cle);
      location.hash = `#/dossier/${encodeURIComponent(dossierId)}`;
    } catch (err) {
      console.error(err);
      bandeau.innerHTML = `<div class="bandeau erreur" role="alert" data-test="echec-ouvrage"><strong>L’enregistrement a échoué.</strong> Vos saisies sont conservées. Réessayez. <code>${esc(err?.message || err)}</code></div>`;
    } finally {
      enCours = false;
      btn.disabled = false;
      btn.textContent = 'Enregistrer l’ouvrage';
    }
  });
}

export { STATUTS_OUVRAGE };
