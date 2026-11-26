// Écran de relevé guidé d'un ouvrage (fenêtre / porte-fenêtre).
import {
  TYPOLOGIES, OUVERTURES, NB_VANTAUX, MATERIAUX, TYPES_POSE, POINTS_DE_VUE, REFERENCES_MESURE,
  ETATS_DORMANT, SENS, STATUTS_OUVRAGE, normaliserOuvrage, analyserOuvrage, prochainRepere,
} from '../domain/ouvrage.js';
import { nouvelId } from '../domain/dossier.js';
import { REGLES } from '../config/regles.js';
import {
  lireDossier, lireOuvrage, listerOuvrages, enregistrerOuvrage,
  lireBrouillon, ecrireBrouillon, effacerBrouillon, cleBrouillonOuvrage,
} from '../storage/db.js';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const mm = (v) => (v == null ? '—' : `${v} mm`);

export function carteOuvrage(dossierId, o) {
  const cls = o.statut === 'complet' ? 'ok' : 'alerte';
  return `<a class="carte" href="#/dossier/${encodeURIComponent(dossierId)}/ouvrage/${encodeURIComponent(o.id)}" data-test="ligne-ouvrage">
    <div class="ligne"><span class="ref">${esc(o.repere)} · ${esc(TYPOLOGIES[o.typologie])}</span>
      <span class="badge ${cls}" data-test="statut-ouvrage">${esc(STATUTS_OUVRAGE[o.statut])}</span></div>
    <div>${esc(o.localisation || 'Localisation ?')} · L ${mm(o.largeurRetenue)} × H ${mm(o.hauteurRetenue)}</div>
    ${o.pointsAVerifier?.length ? `<ul class="points">${o.pointsAVerifier.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}
  </a>`;
}

// ---------- Fragments de formulaire
const radios = (nom, legende, options, { obl = true, aide = '' } = {}) => `
  <fieldset data-champ="${nom}"><legend>${legende}${obl ? ' <span class="obl" aria-hidden="true">*</span>' : ''}</legend>
    ${aide ? `<p class="doux aide">${aide}</p>` : ''}
    <div class="choix">${Object.entries(options).map(([v, l]) => `<label><input type="radio" name="${nom}" value="${v}"> ${esc(l)}</label>`).join('')}</div>
    <div class="msg-champ" id="err-${nom}"></div></fieldset>`;

const texte = (nom, libelle, { obl = true, attrs = '', liste = '' } = {}) => `
  <div data-champ="${nom}"><label for="${nom}">${libelle}${obl ? ' <span class="obl" aria-hidden="true">*</span>' : ''}</label>
  <input id="${nom}" name="${nom}" type="text" ${attrs} ${liste ? `list="${liste}"` : ''}>
  <div class="msg-champ" id="err-${nom}"></div></div>`;

const cote = (nom, libelle) => `
  <div data-champ="${nom}"><label for="${nom}">${libelle}</label>
  <div class="mm"><input id="${nom}" name="${nom}" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" enterkeyhint="next"><span>mm</span></div>
  <div class="msg-champ" id="err-${nom}"></div></div>`;

// Schéma : où prendre les 3 largeurs, 3 hauteurs et 2 diagonales.
function schemaMesures(pdv) {
  const vue = pdv === 'exterieur' ? 'VUE DE L’EXTÉRIEUR' : pdv === 'interieur' ? 'VUE DE L’INTÉRIEUR' : 'POINT DE VUE À PRÉCISER';
  return `<svg class="schema" viewBox="0 0 360 272" role="img" aria-label="Schéma de prise de cotes, ${vue.toLowerCase()}">
    <defs><marker id="fl" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="currentColor"/></marker></defs>
    <text x="180" y="16" text-anchor="middle" class="sv-titre">${vue}</text>
    <rect x="90" y="30" width="180" height="210" class="sv-baie"/>
    <line x1="90" y1="30" x2="270" y2="240" class="sv-diag"/><line x1="270" y1="30" x2="90" y2="240" class="sv-diag"/>
    <text x="226" y="100" class="sv-d">D1</text><text x="122" y="100" class="sv-d">D2</text>
    ${[[52, 'L1 haut'], [135, 'L2 milieu'], [218, 'L3 bas']].map(([y, t]) => `<line x1="94" y1="${y}" x2="266" y2="${y}" class="sv-l" marker-start="url(#fl)" marker-end="url(#fl)"/><text x="145" y="${y - 5}" text-anchor="middle" class="sv-t">${t}</text>`).join('')}
    ${[[110, 'H1 gauche', 84, 'end', 175], [180, 'H2 milieu', 186, 'start', 182], [250, 'H3 droite', 276, 'start', 175]].map(([x, t, tx, ta, ty]) => `<line x1="${x}" y1="34" x2="${x}" y2="236" class="sv-h" marker-start="url(#fl)" marker-end="url(#fl)"/><text x="${tx}" y="${ty}" text-anchor="${ta}" class="sv-t">${t}</text>`).join('')}
    <text x="180" y="262" text-anchor="middle" class="sv-note">Largeur = horizontale · Hauteur = verticale</text>
  </svg>`;
}

// Pictogramme du sens : toujours vu de l'intérieur.
function pictoSens(cote, nbVantaux) {
  const x = cote === 'gauche' ? 14 : 66;
  const charn = [22, 46].map((y) => `<rect x="${x - 3}" y="${y}" width="6" height="10" class="sv-paum"/>`).join('');
  const fleche = cote === 'gauche' ? 'M58,40 q-18,-14 -36,0' : 'M22,40 q18,-14 36,0';
  return `<svg viewBox="0 0 80 92" class="picto" aria-hidden="true"><rect x="14" y="10" width="52" height="60" class="sv-baie"/>
    ${charn}<path d="${fleche}" class="sv-l" marker-end="url(#fl2)"/>
    <defs><marker id="fl2" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="currentColor"/></marker></defs>
    <text x="40" y="88" text-anchor="middle" class="sv-note">${nbVantaux >= 2 ? 'service ' : ''}${cote}</text></svg>`;
}

function formulaire() {
  return `
  <form id="fo" novalidate autocomplete="off">
    <div class="bandeau alerte" data-test="regles-provisoires" ${REGLES.valide ? 'hidden' : ''}>Seuils de contrôle <strong>provisoires</strong> (écarts ${REGLES.ecartMaxEntreMesuresMm} mm, plage ${REGLES.coteMinMm}–${REGLES.coteMaxMm} mm) : à valider par le responsable technique.</div>
    <h2>1. Identification</h2>
    ${radios('typologie', 'Typologie', TYPOLOGIES)}
    <div class="deux">
      <div>${texte('repere', 'Repère', { attrs: 'autocapitalize="characters" maxlength="10"' })}</div>
      <div>${texte('localisation', 'Localisation (pièce)', { liste: 'pieces' })}</div>
    </div>
    <datalist id="pieces"><option>Séjour</option><option>Cuisine</option><option>Chambre 1</option><option>Chambre 2</option><option>Chambre 3</option><option>Salle de bain</option><option>WC</option><option>Entrée</option><option>Bureau</option><option>Garage</option></datalist>
    ${texte('niveau', 'Niveau (RDC, R+1…)', { obl: false })}

    <h2>2. Pose</h2>
    ${radios('typePose', 'Type de pose', TYPES_POSE)}
    <div data-si="typePose" class="case"><label><input type="checkbox" name="poseConfirmee" id="poseConfirmee"> <span>Type de pose <strong>confirmé par le client</strong> pendant le rendez-vous</span></label><div class="msg-champ" id="err-poseConfirmee"></div></div>
    <div class="case"><label><input type="checkbox" name="hesitationPose" id="hesitationPose"> <span>Le client <strong>hésite</strong> entre rénovation et dépose totale → relever aussi l’autre scénario</span></label></div>
    <div data-si="typePose=renovation">${radios('etatDormant', 'État du dormant existant', ETATS_DORMANT)}</div>

    <h2>3. Mesures (en millimètres)</h2>
    ${radios('pointDeVueMesure', 'Mesures prises depuis', POINTS_DE_VUE)}
    ${radios('referenceMesure', 'Mesures prises', REFERENCES_MESURE)}
    <div id="schema">${schemaMesures('')}</div>
    <div class="trois">${cote('L1', 'L1 haut')}${cote('L2', 'L2 milieu')}${cote('L3', 'L3 bas')}</div>
    <div class="trois">${cote('H1', 'H1 gauche')}${cote('H2', 'H2 milieu')}${cote('H3', 'H3 droite')}</div>
    <div class="deux egal">${cote('D1', 'Diagonale D1 (facultatif)')}${cote('D2', 'Diagonale D2 (facultatif)')}</div>
    <div class="retenues" id="retenues" data-test="retenues"></div>
    <div data-si="hesitationPose" class="carte">
      <strong>Scénario alternatif : cotes en tableau</strong>
      <div class="deux egal">${cote('altL', 'Largeur tableau')}${cote('altH', 'Hauteur tableau')}</div>
    </div>

    <h2>4. Ouverture</h2>
    ${radios('typeOuverture', 'Type d’ouverture', OUVERTURES)}
    ${radios('nbVantaux', 'Nombre de vantaux', NB_VANTAUX)}
    <div data-si="ouvrant">
      <fieldset data-champ="sens"><legend><span id="libelle-sens">Côté des paumelles (charnières)</span>, <u>vu de l’intérieur</u> <span class="obl" aria-hidden="true">*</span></legend>
        <div class="choix sens">${Object.keys(SENS).map((v) => `<label><input type="radio" name="sens" value="${v}"><span class="picto-sens" data-sens="${v}"></span></label>`).join('')}</div>
        <div class="msg-champ" id="err-sens"></div></fieldset>
    </div>

    <h2>5. Configuration</h2>
    ${radios('materiau', 'Matériau', MATERIAUX)}
    <div class="deux egal">${texte('colorisInt', 'Coloris intérieur', { liste: 'coloris' })}${texte('colorisExt', 'Coloris extérieur', { liste: 'coloris' })}</div>
    <datalist id="coloris"><option>Blanc</option><option>À définir</option></datalist>
    ${texte('vitrage', 'Vitrage (si connu)', { obl: false })}
    <label for="observations">Observations</label>
    <textarea id="observations" name="observations"></textarea>

    <div id="apercu" class="apercu" aria-live="polite" data-test="apercu"></div>
    <div id="bandeau-o"></div>
    <div class="actions"><button class="btn plein" type="submit" id="enregistrer-ouvrage">Enregistrer l’ouvrage</button></div>
  </form>`;
}

// ---------- Écran
export async function ecranOuvrage(app, dossierId, ouvrageId) {
  const dossier = await lireDossier(dossierId);
  if (!dossier) {
    app.innerHTML = `<div class="bandeau erreur" role="alert">Dossier introuvable sur cet appareil.</div><a class="btn" href="#/">Retour</a>`;
    return;
  }
  const existant = ouvrageId ? await lireOuvrage(ouvrageId) : null;
  if (ouvrageId && (!existant || existant.dossierId !== dossierId)) {
    app.innerHTML = `<div class="bandeau erreur" role="alert">Ouvrage introuvable.</div><a class="btn" href="#/dossier/${encodeURIComponent(dossierId)}">Retour au dossier</a>`;
    return;
  }
  const cle = cleBrouillonOuvrage(dossierId, ouvrageId);
  let brouillon = lireBrouillon(cle);
  const restaure = !!brouillon?.valeurs;
  if (!brouillon) brouillon = { id: existant?.id || nouvelId(), valeurs: existant ? valeursDepuis(existant) : {}, debut: null };

  app.innerHTML = `
    <p class="doux"><a href="#/dossier/${encodeURIComponent(dossierId)}">← ${esc(dossier.reference)} · ${esc(dossier.clientNom)}</a></p>
    <h1>${existant ? `Ouvrage ${esc(existant.repere)} <span class="doux">v${existant.version}</span>` : 'Nouvel ouvrage'}</h1>
    ${restaure ? `<div class="bandeau alerte" data-test="brouillon-restaure">Modifications non enregistrées restaurées.
      <button type="button" class="btn secondaire" id="jeter-o">Annuler ces modifications</button></div>` : ''}
    ${formulaire()}
    <a class="btn secondaire plein" href="#/dossier/${encodeURIComponent(dossierId)}">Retour au dossier</a>`;

  const f = document.getElementById('fo');
  const btn = document.getElementById('enregistrer-ouvrage');
  document.querySelectorAll('.picto-sens').forEach((el) => { el.innerHTML = pictoSens(el.dataset.sens, 1); });
  remplir(f, brouillon.valeurs);
  document.getElementById('jeter-o')?.addEventListener('click', () => { effacerBrouillon(cle); ecranOuvrage(app, dossierId, ouvrageId); });

  const autres = await listerOuvrages(dossierId);
  // Repère proposé automatiquement à la création.
  if (!existant && !f.elements.repere.value) {
    f.elements.typologie.forEach((r) => r.addEventListener('change', () => {
      if (brouillon.repereManuel) return;
      f.elements.repere.value = prochainRepere(r.value, autres);
      brouillon.valeurs = lire();
      ecrireBrouillon(brouillon, cle);
      majEcran();
    }));
  }
  f.elements.repere.addEventListener('input', () => { brouillon.repereManuel = true; });
  // Changer le type de pose annule la confirmation client : elle doit être redonnée.
  f.elements.typePose.forEach((r) => r.addEventListener('change', () => {
    f.elements.poseConfirmee.checked = false;
    brouillon.valeurs = lire();
    ecrireBrouillon(brouillon, cle);
    majEcran();
  }));

  const lire = () => lireValeurs(f);
  const analyser = () => analyserOuvrage(normaliserOuvrage({ ...lire(), id: brouillon.id, dossierId }), { regles: REGLES, dossier, autres });

  const majEcran = () => {
    const v = lire();
    majVisibilite(f, v);
    document.getElementById('schema').innerHTML = schemaMesures(v.pointDeVueMesure);
    const nb = Number(v.nbVantaux) || 1;
    document.getElementById('libelle-sens').textContent = nb >= 2 ? 'Vantail de service (s’ouvre en premier) : côté des paumelles' : 'Côté des paumelles (charnières)';
    document.querySelectorAll('.picto-sens').forEach((el) => { el.innerHTML = pictoSens(el.dataset.sens, nb); });
    const a = analyser();
    document.getElementById('retenues').innerHTML = `Cotes retenues (plus petite mesure) : <strong>L ${mm(a.largeurRetenue)}</strong> × <strong>H ${mm(a.hauteurRetenue)}</strong>`;
    const points = [...a.manquants, ...a.alertes].map((p) => p.msg);
    document.getElementById('apercu').innerHTML = a.statut === 'complet'
      ? `<div class="bandeau ok">Statut à l’enregistrement : <strong>COMPLET</strong></div>`
      : `<div class="bandeau alerte">Statut à l’enregistrement : <strong>À VÉRIFIER</strong> (${points.length} point${points.length > 1 ? 's' : ''})<ul>${points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul></div>`;
  };
  majEcran();

  let enCours = false;
  f.addEventListener('input', (e) => {
    if (!brouillon.debut) brouillon.debut = new Date().toISOString();
    brouillon.valeurs = lire();
    ecrireBrouillon(brouillon, cle);
    const err = document.getElementById('err-' + e.target.name);
    if (err) err.textContent = '';
    e.target.removeAttribute('aria-invalid');
    majEcran();
  });

  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (enCours) return;
    const bandeau = document.getElementById('bandeau-o');
    bandeau.innerHTML = '';
    f.querySelectorAll('.msg-champ').forEach((x) => { x.textContent = ''; });
    f.querySelectorAll('[aria-invalid]').forEach((x) => x.removeAttribute('aria-invalid'));
    const o = normaliserOuvrage({ ...lire(), id: brouillon.id, dossierId });
    const a = analyserOuvrage(o, { regles: REGLES, dossier, autres });
    if (!a.valideEnregistrement) {
      for (const [k, m] of Object.entries(a.erreurs)) {
        const el = document.getElementById('err-' + k);
        if (el) el.textContent = m;
        f.querySelectorAll(`[name="${k}"]`).forEach((x) => x.setAttribute('aria-invalid', 'true'));
      }
      bandeau.innerHTML = `<div class="bandeau erreur" role="alert" data-test="erreurs-ouvrage"><strong>À corriger avant d’enregistrer :</strong>
        <ul>${Object.values(a.erreurs).map((m) => `<li>${esc(m)}</li>`).join('')}</ul></div>`;
      const premier = f.querySelector('[aria-invalid="true"]');
      premier?.focus();
      premier?.scrollIntoView({ block: 'center' });
      return;
    }
    enCours = true;
    btn.disabled = true;
    btn.textContent = 'Enregistrement…';
    try {
      const fin = new Date();
      const dureeSec = brouillon.debut ? (fin - new Date(brouillon.debut)) / 1000 : 0;
      const confirmeAvant = existant?.poseConfirmee && existant.typePose === o.typePose;
      await enregistrerOuvrage({
        ...o,
        poseConfirmeeLe: o.poseConfirmee ? (confirmeAvant ? existant.poseConfirmeeLe : fin.toISOString()) : null,
        statut: a.statut,
        pointsAVerifier: [...a.manquants, ...a.alertes].map((p) => p.msg),
        largeurRetenue: a.largeurRetenue,
        hauteurRetenue: a.hauteurRetenue,
        reglesValidees: REGLES.valide,
      }, { dureeSec, maintenant: fin });
      effacerBrouillon(cle);
      location.hash = `#/dossier/${encodeURIComponent(dossierId)}`;
    } catch (err) {
      console.error(err);
      bandeau.innerHTML = `<div class="bandeau erreur" role="alert" data-test="echec-ouvrage"><strong>L’enregistrement a échoué.</strong>
        Vos saisies sont conservées sur cet appareil. Réessayez. <code>${esc(err?.name || '')} ${esc(err?.message || err)}</code></div>`;
      bandeau.scrollIntoView({ block: 'center' });
    } finally {
      enCours = false;
      btn.disabled = false;
      btn.textContent = 'Enregistrer l’ouvrage';
    }
  });
}

// ---------- Outils formulaire
function valeursDepuis(o) {
  const v = {
    typologie: o.typologie, repere: o.repere, localisation: o.localisation, niveau: o.niveau, typePose: o.typePose,
    poseConfirmee: o.poseConfirmee, hesitationPose: o.hesitationPose, etatDormant: o.etatDormant,
    pointDeVueMesure: o.pointDeVueMesure, referenceMesure: o.referenceMesure, typeOuverture: o.typeOuverture,
    nbVantaux: o.nbVantaux ? String(o.nbVantaux) : '', sens: o.sens, materiau: o.materiau,
    colorisInt: o.colorisInt, colorisExt: o.colorisExt, vitrage: o.vitrage, observations: o.observations,
    altL: o.alt?.largeur ?? '', altH: o.alt?.hauteur ?? '',
  };
  ['L1', 'L2', 'L3'].forEach((k, i) => { v[k] = o.largeurs?.[i] ?? ''; });
  ['H1', 'H2', 'H3'].forEach((k, i) => { v[k] = o.hauteurs?.[i] ?? ''; });
  ['D1', 'D2'].forEach((k, i) => { v[k] = o.diagonales?.[i] ?? ''; });
  return v;
}

function remplir(f, valeurs) {
  for (const [k, v] of Object.entries(valeurs)) {
    const el = f.elements[k];
    if (!el) continue;
    if (el instanceof RadioNodeList) el.forEach((r) => { r.checked = r.value === String(v); });
    else if (el.type === 'checkbox') el.checked = v === true;
    else el.value = v ?? '';
  }
}

// Les champs masqués (non applicables) ne sont pas lus : pas de valeur périmée enregistrée.
function lireValeurs(f) {
  const o = {};
  for (const el of f.elements) {
    if (!el.name || el.closest('[hidden]')) continue;
    if (el.type === 'radio') { if (el.checked) o[el.name] = el.value; else o[el.name] ??= ''; }
    else if (el.type === 'checkbox') o[el.name] = el.checked;
    else o[el.name] = el.value;
  }
  return o;
}

function majVisibilite(f, v) {
  for (const bloc of f.querySelectorAll('[data-si]')) {
    const [champ, val] = bloc.dataset.si.split('=');
    let visible;
    if (champ === 'ouvrant') visible = v.typeOuverture !== 'fixe';
    else if (champ === 'hesitationPose') visible = f.elements.hesitationPose.checked;
    else visible = val ? f.querySelector(`[name="${champ}"]:checked`)?.value === val : !!f.querySelector(`[name="${champ}"]:checked`);
    bloc.hidden = !visible;
  }
}
