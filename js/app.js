import {
  TYPES_CHANTIER, NATURES_BATIMENT, STATUTS,
  normaliserDossier, validerDossier, detecterDoublons, nouvelId,
} from './domain/dossier.js';
import {
  ouvrirDb, creerDossier, listerDossiers, lireDossier,
  lireBrouillon, ecrireBrouillon, effacerBrouillon, demanderStockagePersistant, dateLocaleIso,
} from './storage/db.js';

const app = document.getElementById('app');
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dateFr = (iso) => (iso ? new Date(iso.length === 10 ? iso + 'T12:00:00' : iso).toLocaleDateString('fr-FR') : '');
const heureFr = (iso) => new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
const duree = (s) => (s == null ? '—' : s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`);

// ------------------------------------------------------------------ Routage
async function router() {
  const h = location.hash || '#/';
  try {
    if (h.startsWith('#/nouveau')) return ecranNouveau();
    const m = h.match(/^#\/dossier\/([^?]+)(\?cree=1)?/);
    if (m) return ecranDossier(decodeURIComponent(m[1]), !!m[2]);
    return ecranListe();
  } catch (e) {
    erreurGlobale(e);
  }
}
window.addEventListener('hashchange', router);

function erreurGlobale(e) {
  console.error(e);
  app.innerHTML = `<div class="bandeau erreur" role="alert"><strong>Le stockage local est indisponible.</strong>
    <p>${esc(e?.message || e)}</p><p>Vérifiez que la navigation privée est désactivée, puis rechargez la page.</p></div>
    <button class="btn" onclick="location.reload()">Recharger</button>`;
}

// ------------------------------------------------------------------ Liste
async function ecranListe() {
  const dossiers = await listerDossiers();
  app.innerHTML = `
    <h1>Dossiers</h1>
    <div class="actions"><a class="btn plein" href="#/nouveau" data-test="nouveau">+ Nouveau dossier</a></div>
    ${dossiers.length > 3 ? `<input class="recherche" type="search" placeholder="Rechercher : nom, commune, référence…" aria-label="Rechercher" id="q">` : ''}
    <div id="liste">${dossiers.length ? '' : '<p class="doux">Aucun dossier pour l’instant.</p>'}</div>
    <div class="actions">
      <button class="btn secondaire" id="export" ${dossiers.length ? '' : 'disabled'}>Exporter une sauvegarde (JSON)</button>
    </div>`;
  const rendre = (liste) => {
    if (!dossiers.length) return;
    document.getElementById('liste').innerHTML = liste.map((d) => `
      <a class="carte" href="#/dossier/${encodeURIComponent(d.id)}" data-test="ligne-dossier">
        <div class="ligne"><span class="ref">${esc(d.reference)}</span><span class="badge">${esc(STATUTS[d.statut] || d.statut)}</span></div>
        <div><strong>${esc(d.clientNom)}</strong> · ${esc(d.commune)}</div>
        <div class="doux">RDV ${esc(dateFr(d.dateRdv))} · ${esc(TYPES_CHANTIER[d.typeChantier] || '')} · saisie ${esc(duree(d.saisieDureeSec))}</div>
      </a>`).join('') || '<p class="doux">Aucun résultat.</p>';
  };
  rendre(dossiers);
  document.getElementById('q')?.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase().trim();
    rendre(dossiers.filter((d) => [d.reference, d.clientNom, d.commune, d.adresse, d.telephone].join(' ').toLowerCase().includes(q)));
  });
  document.getElementById('export').onclick = () => {
    const blob = new Blob([JSON.stringify({ exporteLe: new Date().toISOString(), dossiers }, null, 2)], { type: 'application/json' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `sauvegarde-pilotage-${dateLocaleIso(new Date())}.json` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
}

// ------------------------------------------------------------------ Nouveau dossier
const champ = (nom, libelle, { type = 'text', obl = true, attrs = '' } = {}) => `
  <label for="${nom}">${libelle}${obl ? ' <span class="obl" aria-hidden="true">*</span>' : ''}</label>
  <input id="${nom}" name="${nom}" type="${type}" ${attrs} aria-describedby="err-${nom}">
  <div class="msg-champ" id="err-${nom}"></div>`;

const choix = (nom, legende, options) => `
  <fieldset aria-describedby="err-${nom}"><legend>${legende} <span class="obl" aria-hidden="true">*</span></legend>
    <div class="choix">${Object.entries(options).map(([v, l]) =>
      `<label><input type="radio" name="${nom}" value="${v}"> ${l}</label>`).join('')}</div>
    <div class="msg-champ" id="err-${nom}"></div></fieldset>`;

function ecranNouveau() {
  let brouillon = lireBrouillon();
  const restaure = !!(brouillon && brouillon.valeurs && Object.values(brouillon.valeurs).some((v) => v));
  if (!brouillon) brouillon = { id: nouvelId(), valeurs: {}, debut: null };

  app.innerHTML = `
    <h1>Nouveau dossier</h1>
    ${restaure ? `<div class="bandeau alerte" data-test="brouillon-restaure">Brouillon non enregistré restauré.
      <button type="button" class="btn secondaire" id="jeter">Effacer le brouillon</button></div>` : ''}
    <div id="bandeau"></div>
    <form id="f" novalidate autocomplete="off">
      <h2>Client</h2>
      ${champ('clientNom', 'Nom du client', { attrs: 'autocomplete="off" autocapitalize="words"' })}
      ${champ('telephone', 'Téléphone', { type: 'tel', attrs: 'inputmode="tel"' })}
      ${champ('email', 'E-mail', { type: 'email', obl: false, attrs: 'inputmode="email"' })}
      <h2>Chantier</h2>
      ${champ('adresse', 'Adresse du chantier')}
      <div class="deux">
        <div>${champ('codePostal', 'Code postal', { attrs: 'inputmode="numeric" maxlength="5"' })}</div>
        <div>${champ('commune', 'Commune')}</div>
      </div>
      ${choix('typeChantier', 'Type de chantier', TYPES_CHANTIER)}
      ${choix('natureBatiment', 'Nature du bâtiment', NATURES_BATIMENT)}
      <label for="description">Description du projet</label>
      <textarea id="description" name="description"></textarea>
      <label for="contraintes">Contraintes particulières (accès, stationnement, animaux…)</label>
      <textarea id="contraintes" name="contraintes"></textarea>
      <h2>Rendez-vous</h2>
      ${champ('responsable', 'Responsable du relevé')}
      ${champ('dateRdv', 'Date du rendez-vous', { type: 'date' })}
      <div id="doublons"></div>
      <div class="actions"><button class="btn plein" type="submit" id="enregistrer">Enregistrer le dossier</button></div>
      <a href="#/" class="btn secondaire plein">Retour à la liste</a>
    </form>`;

  const f = document.getElementById('f');
  const btn = document.getElementById('enregistrer');
  const v0 = brouillon.valeurs;
  if (!v0.dateRdv) v0.dateRdv = dateLocaleIso(new Date());
  if (!v0.responsable) { try { v0.responsable = localStorage.getItem('pt.responsable') || ''; } catch { /* */ } }
  for (const [k, v] of Object.entries(v0)) {
    const el = f.elements[k];
    if (!el) continue;
    if (el instanceof RadioNodeList) { for (const r of el) r.checked = r.value === v; } else el.value = v;
  }

  const lireValeurs = () => {
    const o = {};
    for (const el of f.elements) if (el.name) {
      if (el.type === 'radio') { if (el.checked) o[el.name] = el.value; else o[el.name] ??= ''; } else o[el.name] = el.value;
    }
    return o;
  };

  let doublonConfirme = false;
  let enCours = false;
  f.addEventListener('input', (e) => {
    if (!brouillon.debut) brouillon.debut = new Date().toISOString();
    brouillon.valeurs = lireValeurs();
    ecrireBrouillon(brouillon);
    if (['telephone', 'adresse', 'codePostal'].includes(e.target.name)) {
      doublonConfirme = false;
      document.getElementById('doublons').innerHTML = '';
    }
    const err = document.getElementById('err-' + e.target.name);
    if (err && err.textContent) { err.textContent = ''; marquer(e.target.name, false); }
  });
  document.getElementById('jeter')?.addEventListener('click', () => { effacerBrouillon(); ecranNouveau(); });

  function marquer(nom, invalide) {
    const el = f.elements[nom];
    const liste = el instanceof RadioNodeList ? [...el] : [el];
    liste.forEach((x) => x.setAttribute('aria-invalid', String(invalide)));
  }

  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (enCours) return; // anti double-clic
    const bandeau = document.getElementById('bandeau');
    bandeau.innerHTML = '';
    const d = normaliserDossier({ ...lireValeurs(), id: brouillon.id });
    const { valide, erreurs } = validerDossier(d);
    for (const el of f.querySelectorAll('.msg-champ')) el.textContent = '';
    for (const el of f.querySelectorAll('[aria-invalid]')) el.removeAttribute('aria-invalid');
    if (!valide) {
      for (const [k, m] of Object.entries(erreurs)) {
        document.getElementById('err-' + k).textContent = m;
        marquer(k, true);
      }
      bandeau.innerHTML = `<div class="bandeau erreur" role="alert" data-test="erreurs">
        <strong>${Object.keys(erreurs).length} champ(s) à compléter</strong>
        <ul>${Object.values(erreurs).map((m) => `<li>${esc(m)}</li>`).join('')}</ul></div>`;
      const premier = f.elements[Object.keys(erreurs)[0]];
      (premier instanceof RadioNodeList ? premier[0] : premier).focus();
      return;
    }

    enCours = true;
    btn.disabled = true;
    btn.textContent = 'Enregistrement…';
    try {
      if (!doublonConfirme) {
        const doublons = detecterDoublons(d, await listerDossiers());
        if (doublons.length) {
          document.getElementById('doublons').innerHTML = `<div class="bandeau alerte" role="alert" data-test="doublons">
            <strong>Dossier peut-être déjà existant :</strong>
            <ul>${doublons.map((x) => `<li><a href="#/dossier/${encodeURIComponent(x.dossier.id)}">${esc(x.dossier.reference)} — ${esc(x.dossier.clientNom)}, ${esc(x.dossier.commune)}</a> (${esc(x.motifs.join(', '))})</li>`).join('')}</ul>
            <p>Un même client peut avoir plusieurs chantiers. Confirmez si c’est un nouveau dossier.</p>
            <button type="button" class="btn" id="confirmer" data-test="creer-quand-meme">Créer quand même</button></div>`;
          document.getElementById('confirmer').onclick = () => { doublonConfirme = true; f.requestSubmit(); };
          return;
        }
      }
      const fin = new Date();
      const debut = brouillon.debut ? new Date(brouillon.debut) : fin;
      const { dossier } = await creerDossier({
        ...d,
        statut: 'releve_en_cours',
        saisieDebut: debut.toISOString(),
        saisieDureeSec: Math.max(0, Math.round((fin - debut) / 1000)),
      }, fin);
      try { localStorage.setItem('pt.responsable', d.responsable); } catch { /* */ }
      effacerBrouillon();
      location.hash = `#/dossier/${encodeURIComponent(dossier.id)}?cree=1`;
    } catch (err) {
      console.error(err);
      bandeau.innerHTML = `<div class="bandeau erreur" role="alert" data-test="echec">
        <strong>L’enregistrement a échoué.</strong> Vos saisies sont conservées sur cet appareil.
        Réessayez ; si le problème persiste, notez l’erreur : <code>${esc(err?.name || '')} ${esc(err?.message || err)}</code></div>`;
      bandeau.scrollIntoView({ block: 'center' });
    } finally {
      enCours = false;
      btn.disabled = false;
      btn.textContent = 'Enregistrer le dossier';
    }
  });
}

// ------------------------------------------------------------------ Détail
async function ecranDossier(id, cree) {
  const d = await lireDossier(id);
  if (!d) {
    app.innerHTML = `<div class="bandeau erreur" role="alert">Dossier introuvable sur cet appareil.</div><a class="btn" href="#/">Retour</a>`;
    return;
  }
  const L = (k, v) => `<dt>${k}</dt><dd>${esc(v) || '—'}</dd>`;
  app.innerHTML = `
    ${cree ? `<div class="bandeau ok" role="status" data-test="cree">Dossier enregistré sur cet appareil.</div>` : ''}
    <h1 class="ref" data-test="reference">${esc(d.reference)}</h1>
    <div class="carte"><dl>
      ${L('Statut', STATUTS[d.statut] || d.statut)}
      ${L('Client', d.clientNom)}${L('Téléphone', d.telephone.replace(/(\d{2})(?=\d)/g, '$1 '))}${L('E-mail', d.email)}
      ${L('Adresse', `${d.adresse}\n${d.codePostal} ${d.commune}`)}
      ${L('Type de chantier', TYPES_CHANTIER[d.typeChantier])}${L('Bâtiment', NATURES_BATIMENT[d.natureBatiment])}
      ${L('Projet', d.description)}${L('Contraintes', d.contraintes)}
      ${L('Responsable', d.responsable)}${L('Rendez-vous', dateFr(d.dateRdv))}
      ${L('Créé le', heureFr(d.creeLe))}${L('Durée de saisie', duree(d.saisieDureeSec))}
    </dl></div>
    <p class="doux">Étape suivante (à venir) : ajouter les ouvrages et le relevé guidé.</p>
    <div class="actions"><a class="btn" href="#/">Retour à la liste</a><a class="btn secondaire" href="#/nouveau">+ Autre dossier</a></div>`;
}

// ------------------------------------------------------------------ Démarrage
(async () => {
  try {
    await ouvrirDb();
    const persistant = await demanderStockagePersistant();
    document.getElementById('pied').textContent = persistant
      ? 'Données stockées uniquement sur cet appareil (stockage persistant).'
      : 'Données stockées uniquement sur cet appareil. Exportez une sauvegarde régulièrement.';
    await router();
  } catch (e) {
    erreurGlobale(e);
  }
})();
