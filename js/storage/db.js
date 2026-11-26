// Stockage local sur l'appareil (IndexedDB). Aucune donnée n'est envoyée à un serveur.
import { genererReference, prefixeReference, prochaineSequence } from '../domain/dossier.js';

const NOM_BASE = 'pilotage-terrain';
const VERSION = 1;
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
      r.onupgradeneeded = () => {
        const db = r.result;
        const s = db.createObjectStore('dossiers', { keyPath: 'id' });
        s.createIndex('reference', 'reference', { unique: true });
        s.createIndex('creeLe', 'creeLe');
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

// --- Brouillon du formulaire (survit à un rechargement, un crash ou une coupure) ---
const CLE_BROUILLON = 'pt.brouillon.nouveauDossier';

export function lireBrouillon() {
  try {
    const v = localStorage.getItem(CLE_BROUILLON);
    return v ? JSON.parse(v) : null;
  } catch {
    return null;
  }
}

export function ecrireBrouillon(b) {
  try {
    localStorage.setItem(CLE_BROUILLON, JSON.stringify(b));
    return true;
  } catch {
    return false;
  }
}

export function effacerBrouillon() {
  try {
    localStorage.removeItem(CLE_BROUILLON);
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
