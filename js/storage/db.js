// Stockage local sur l'appareil (IndexedDB). Aucune donnée n'est envoyée à un serveur.
import { genererReference, prefixeReference, prochaineSequence } from '../domain/dossier.js';

const NOM_BASE = 'pilotage-terrain';
const VERSION = 3; // v1 : dossiers — v2 : + ouvrages — v3 : + photos
let dbPromise = null;

function req(r) {
  return new Promise((ok, ko) => {
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ko(r.error);
  });
}

export function ouvrirDb() {
  if (!dbPromise) {
    dbPromise = new Promise((ok, ko) => {
      const r = indexedDB.open(NOM_BASE, VERSION);
      // Migrations successives : les données d'une version antérieure sont conservées.
      r.onupgradeneeded = (ev) => {
        const db = r.result;
        if (ev.oldVersion < 1) {
          const s = db.createObjectStore('dossiers', { keyPath: 'id' });
          s.createIndex('reference', 'reference', { unique: true });
          s.createIndex('creeLe', 'creeLe');
        }
        if (ev.oldVersion < 2) {
          const o = db.createObjectStore('ouvrages', { keyPath: 'id' });
          o.createIndex('dossierId', 'dossierId');
        }
        if (ev.oldVersion < 3) {
          const ph = db.createObjectStore('photos', { keyPath: 'id' });
          ph.createIndex('ouvrageId', 'ouvrageId');
          ph.createIndex('dossierId', 'dossierId');
        }
      };
      r.onsuccess = () => ok(r.result);
      r.onerror = () => ko(r.error);
      r.onblocked = () => ko(new Error('Base bloquée : fermez les autres onglets de l’application.'));
    }).catch((e) => {
      dbPromise = null; // permet une nouvelle tentative
      throw e;
    });
  }
  return dbPromise;
}

// Création idempotente : si un dossier avec le même id existe déjà (double envoi),
// on renvoie l'existant au lieu d'en créer un second.
// Tout se fait dans UNE transaction readwrite : IndexedDB les sérialise, donc deux
// onglets ne peuvent pas obtenir la même référence.
export async function creerDossier(dossier, maintenant = new Date()) {
  const db = await ouvrirDb();
  return new Promise((ok, ko) => {
    let resultat;
    const tx = db.transaction('dossiers', 'readwrite');
    const s = tx.objectStore('dossiers');
    tx.oncomplete = () => ok(resultat);
    tx.onerror = () => ko(tx.error);
    tx.onabort = () => ko(tx.error || new Error('Enregistrement annulé.'));

    try {
      s.get(dossier.id).onsuccess = (ev) => {
        try {
          const existant = ev.target.result;
          if (existant) {
            resultat = { dossier: existant, dejaExistant: true };
            return;
          }
          const jour = dateLocaleIso(maintenant);
          const prefixe = prefixeReference(jour);
          const plage = IDBKeyRange.bound(prefixe, prefixe + '￿');
          const refs = [];
          const cur = s.index('reference').openKeyCursor(plage);
          cur.onsuccess = (e2) => {
            try {
              const c = e2.target.result;
              if (c) {
                refs.push(c.key);
                c.continue();
                return;
              }
              const nouveau = {
                ...dossier,
                reference: genererReference(jour, prochaineSequence(prefixe, refs)),
                creeLe: maintenant.toISOString(),
                modifieLe: maintenant.toISOString(),
                version: 1,
              };
              s.add(nouveau);
              resultat = { dossier: nouveau, dejaExistant: false };
            } catch (err) {
              tx.abort();
              ko(err);
            }
          };
        } catch (err) {
          tx.abort();
          ko(err);
        }
      };
    } catch (err) {
      ko(err);
    }
  });
}

export async function listerDossiers() {
  const db = await ouvrirDb();
  const tous = await req(db.transaction('dossiers').objectStore('dossiers').getAll());
  return tous.sort((a, b) => (a.creeLe < b.creeLe ? 1 : -1));
}

export async function lireDossier(id) {
  const db = await ouvrirDb();
  return req(db.transaction('dossiers').objectStore('dossiers').get(id));
}

export function dateLocaleIso(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// --- Ouvrages ---
const CHAMPS_TECHNIQUES = ['version', 'creeLe', 'modifieLe', 'saisieDureeSec', 'historique'];
const contenu = (o) => JSON.stringify(Object.fromEntries(Object.entries(o).filter(([k]) => !CHAMPS_TECHNIQUES.includes(k)).sort()));

// Création ou mise à jour idempotente : renvoyer deux fois le même contenu ne crée
// ni doublon ni nouvelle version. Chaque modification réelle incrémente la version
// et ajoute une ligne d'historique (date, version).
export async function enregistrerOuvrage(ouvrage, { dureeSec = 0, maintenant = new Date() } = {}) {
  const db = await ouvrirDb();
  return new Promise((ok, ko) => {
    let resultat;
    const tx = db.transaction(['ouvrages', 'dossiers'], 'readwrite');
    tx.oncomplete = () => ok(resultat);
    tx.onerror = () => ko(tx.error);
    tx.onabort = () => ko(tx.error || new Error('Enregistrement annulé.'));
    const s = tx.objectStore('ouvrages');
    tx.objectStore('dossiers').get(ouvrage.dossierId).onsuccess = (e0) => {
      try {
        if (!e0.target.result) { tx.abort(); ko(new Error('Dossier introuvable.')); return; }
        s.get(ouvrage.id).onsuccess = (ev) => {
          try {
            const ancien = ev.target.result;
            const t = maintenant.toISOString();
            if (ancien && contenu(ancien) === contenu(ouvrage)) { resultat = { ouvrage: ancien, inchange: true }; return; }
            const version = (ancien?.version || 0) + 1;
            const nouveau = {
              ...ouvrage,
              creeLe: ancien?.creeLe || t,
              modifieLe: t,
              version,
              saisieDureeSec: (ancien?.saisieDureeSec || 0) + Math.max(0, Math.round(dureeSec)),
              historique: [...(ancien?.historique || []), { version, le: t, action: ancien ? 'modification' : 'création' }],
            };
            s.put(nouveau);
            resultat = { ouvrage: nouveau, inchange: false };
          } catch (err) { tx.abort(); ko(err); }
        };
      } catch (err) { tx.abort(); ko(err); }
    };
  });
}

export async function listerOuvrages(dossierId) {
  const db = await ouvrirDb();
  return req(db.transaction('ouvrages').objectStore('ouvrages').index('dossierId').getAll(dossierId));
}

export async function lireOuvrage(id) {
  const db = await ouvrirDb();
  return req(db.transaction('ouvrages').objectStore('ouvrages').get(id));
}

export async function toutesLesDonnees() {
  const db = await ouvrirDb();
  const tx = db.transaction(['dossiers', 'ouvrages', 'photos']);
  const [dossiers, ouvrages, photos] = await Promise.all(['dossiers', 'ouvrages', 'photos'].map((n) => req(tx.objectStore(n).getAll())));
  return { dossiers, ouvrages, photos };
}

// Met à jour le statut d'un ouvrage déjà enregistré (ex. après ajout/suppression de photo)
// sans créer de nouvelle version du relevé, mais avec une trace dans l'historique.
export async function majStatutOuvrage(id, { statut, pointsAVerifier }, action, maintenant = new Date()) {
  const db = await ouvrirDb();
  return new Promise((ok, ko) => {
    let resultat = null;
    const tx = db.transaction('ouvrages', 'readwrite');
    tx.oncomplete = () => ok(resultat);
    tx.onerror = () => ko(tx.error);
    const s = tx.objectStore('ouvrages');
    s.get(id).onsuccess = (e) => {
      const o = e.target.result;
      if (!o) return; // ouvrage pas encore enregistré : rien à faire
      resultat = {
        ...o, statut, pointsAVerifier, modifieLe: maintenant.toISOString(),
        historique: [...(o.historique || []), { version: o.version, le: maintenant.toISOString(), action }],
      };
      s.put(resultat);
    };
  });
}

// --- Photos ---
export class PhotoEnDouble extends Error {
  constructor() { super('Cette photo est déjà rattachée à l’ouvrage.'); this.name = 'PhotoEnDouble'; }
}

// Ajout atomique : refus si la même photo (même empreinte) est déjà sur l'ouvrage.
export async function ajouterPhoto(photo) {
  const db = await ouvrirDb();
  return new Promise((ok, ko) => {
    const tx = db.transaction('photos', 'readwrite');
    let echec = null;
    tx.oncomplete = () => ok(photo);
    tx.onerror = () => ko(echec || tx.error);
    tx.onabort = () => ko(echec || tx.error || new Error('Ajout annulé.'));
    const s = tx.objectStore('photos');
    s.index('ouvrageId').getAll(photo.ouvrageId).onsuccess = (e) => {
      try {
        if (photo.empreinte && e.target.result.some((p) => p.empreinte === photo.empreinte)) {
          echec = new PhotoEnDouble();
          tx.abort();
          return;
        }
        s.add(photo);
      } catch (err) { echec = err; tx.abort(); }
    };
  });
}

export async function listerPhotos(ouvrageId) {
  const db = await ouvrirDb();
  const t = await req(db.transaction('photos').objectStore('photos').index('ouvrageId').getAll(ouvrageId));
  return t.sort((a, b) => (a.creeLe < b.creeLe ? -1 : 1));
}

export async function compterPhotosParOuvrage(dossierId) {
  const db = await ouvrirDb();
  const keys = await req(db.transaction('photos').objectStore('photos').index('dossierId').getAll(dossierId));
  const n = {};
  for (const p of keys) n[p.ouvrageId] = (n[p.ouvrageId] || 0) + 1;
  return n;
}

export async function majLegendePhoto(id, legende) {
  const db = await ouvrirDb();
  return new Promise((ok, ko) => {
    const tx = db.transaction('photos', 'readwrite');
    tx.oncomplete = () => ok();
    tx.onerror = () => ko(tx.error);
    const s = tx.objectStore('photos');
    s.get(id).onsuccess = (e) => { if (e.target.result) s.put({ ...e.target.result, legende }); };
  });
}

export async function supprimerPhoto(id) {
  const db = await ouvrirDb();
  return new Promise((ok, ko) => {
    const tx = db.transaction('photos', 'readwrite');
    tx.oncomplete = () => ok();
    tx.onerror = () => ko(tx.error);
    tx.objectStore('photos').delete(id);
  });
}

// Utilisé quand on abandonne un ouvrage jamais enregistré : ses photos sont supprimées.
export async function supprimerPhotosOuvrage(ouvrageId) {
  const db = await ouvrirDb();
  return new Promise((ok, ko) => {
    const tx = db.transaction('photos', 'readwrite');
    tx.oncomplete = () => ok();
    tx.onerror = () => ko(tx.error);
    const s = tx.objectStore('photos');
    s.index('ouvrageId').getAllKeys(ouvrageId).onsuccess = (e) => e.target.result.forEach((k) => s.delete(k));
  });
}

// Espace disponible (estimation du navigateur), en octets.
export async function espaceStockage() {
  try {
    const { usage = 0, quota = 0 } = (await navigator.storage?.estimate?.()) || {};
    return { usage, quota, libre: quota ? quota - usage : null };
  } catch {
    return { usage: 0, quota: 0, libre: null };
  }
}

// --- Brouillons de formulaire (survivent à un rechargement, un crash ou une coupure) ---
export const CLE_BROUILLON_DOSSIER = 'pt.brouillon.nouveauDossier';
export const cleBrouillonOuvrage = (dossierId, ouvrageId) => `pt.brouillon.ouvrage.${dossierId}.${ouvrageId || 'nouveau'}`;

export function lireBrouillon(cle = CLE_BROUILLON_DOSSIER) {
  try {
    const v = localStorage.getItem(cle);
    return v ? JSON.parse(v) : null;
  } catch {
    return null;
  }
}

export function ecrireBrouillon(b, cle = CLE_BROUILLON_DOSSIER) {
  try {
    localStorage.setItem(cle, JSON.stringify(b));
    return true;
  } catch {
    return false;
  }
}

export function effacerBrouillon(cle = CLE_BROUILLON_DOSSIER) {
  try {
    localStorage.removeItem(cle);
  } catch {
    /* rien */
  }
}

// Demande au navigateur de ne pas effacer les données en cas de manque d'espace.
export async function demanderStockagePersistant() {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true;
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch {
    /* non supporté */
  }
  return false;
}
