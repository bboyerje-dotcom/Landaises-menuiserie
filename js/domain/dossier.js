// Règles métier du dossier client/chantier.
// Module pur (aucune dépendance au navigateur) : testé avec `node --test`.

export const TYPES_CHANTIER = {
  neuf: 'Construction neuve',
  renovation: 'Rénovation',
  reparation: 'Réparation',
};

export const NATURES_BATIMENT = {
  maison: 'Maison individuelle',
  appartement: 'Appartement',
  local_pro: 'Local professionnel',
  autre: 'Autre',
};

export const STATUTS = {
  releve_en_cours: 'Relevé en cours',
};

const ligne = (v) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '');
const texte = (v) => (typeof v === 'string' ? v.trim() : '');

export function normaliserTelephone(v) {
  let d = String(v ?? '').replace(/[^\d+]/g, '');
  if (d.startsWith('+33')) d = '0' + d.slice(3);
  else if (d.startsWith('0033')) d = '0' + d.slice(4);
  return d.replace(/\+/g, '');
}

export function normaliserDossier(saisie = {}) {
  return {
    id: saisie.id,
    clientNom: ligne(saisie.clientNom),
    telephone: normaliserTelephone(saisie.telephone),
    email: ligne(saisie.email).toLowerCase(),
    adresse: ligne(saisie.adresse),
    codePostal: ligne(saisie.codePostal).replace(/\s/g, ''),
    commune: ligne(saisie.commune),
    responsable: ligne(saisie.responsable),
    dateRdv: ligne(saisie.dateRdv),
    typeChantier: ligne(saisie.typeChantier),
    natureBatiment: ligne(saisie.natureBatiment),
    description: texte(saisie.description),
    contraintes: texte(saisie.contraintes),
  };
}

function dateIsoValide(v) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [a, m, j] = v.split('-').map(Number);
  const d = new Date(Date.UTC(a, m - 1, j));
  return d.getUTCFullYear() === a && d.getUTCMonth() === m - 1 && d.getUTCDate() === j;
}

// Retourne { valide, erreurs: { champ: message } }. Ne modifie pas le dossier.
export function validerDossier(d) {
  const e = {};
  if (d.clientNom.length < 2) e.clientNom = 'Nom du client obligatoire.';
  if (!d.telephone) e.telephone = 'Téléphone obligatoire.';
  else if (!/^0[1-9]\d{8}$/.test(d.telephone)) e.telephone = 'Téléphone invalide (10 chiffres, ex. 06 12 34 56 78).';
  if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) e.email = 'E-mail invalide.';
  if (d.adresse.length < 3) e.adresse = 'Adresse du chantier obligatoire.';
  if (!/^\d{5}$/.test(d.codePostal)) e.codePostal = 'Code postal à 5 chiffres obligatoire.';
  if (d.commune.length < 2) e.commune = 'Commune obligatoire.';
  if (d.responsable.length < 2) e.responsable = 'Responsable du relevé obligatoire.';
  if (!dateIsoValide(d.dateRdv)) e.dateRdv = 'Date du rendez-vous obligatoire.';
  if (!(d.typeChantier in TYPES_CHANTIER)) e.typeChantier = 'Type de chantier obligatoire.';
  if (!(d.natureBatiment in NATURES_BATIMENT)) e.natureBatiment = 'Nature du bâtiment obligatoire.';
  return { valide: Object.keys(e).length === 0, erreurs: e };
}

// Référence lisible : LDM-AAMMJJ-NNN (NNN = rang du dossier créé ce jour-là sur cet appareil).
export function prefixeReference(dateIso) {
  const [a, m, j] = dateIso.split('-');
  return `LDM-${a.slice(2)}${m}${j}-`;
}

export function genererReference(dateIso, sequence) {
  return prefixeReference(dateIso) + String(sequence).padStart(3, '0');
}

export function prochaineSequence(prefixe, referencesExistantes) {
  let max = 0;
  for (const r of referencesExistantes) {
    if (r && r.startsWith(prefixe)) {
      const n = Number(r.slice(prefixe.length));
      if (Number.isInteger(n) && n > max) max = n;
    }
  }
  return max + 1;
}

const cleAdresse = (d) =>
  (d.adresse + ' ' + d.codePostal)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');

// Doublons probables : même téléphone ou même adresse de chantier. Avertissement, pas blocage
// (un même client peut avoir deux chantiers).
export function detecterDoublons(nouveau, existants) {
  const res = [];
  for (const x of existants) {
    if (x.id === nouveau.id) continue;
    const motifs = [];
    if (nouveau.telephone && x.telephone === nouveau.telephone) motifs.push('même téléphone');
    if (nouveau.adresse && cleAdresse(x) === cleAdresse(nouveau)) motifs.push('même adresse de chantier');
    if (motifs.length) res.push({ dossier: x, motifs });
  }
  return res;
}

// Identifiant unique, y compris hors contexte sécurisé (http sur réseau local),
// où crypto.randomUUID n'existe pas.
export function nouvelId(c = globalThis.crypto) {
  if (c?.randomUUID) return c.randomUUID();
  const b = new Uint8Array(16);
  c.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
