// Lecture des cotes saisies. Module pur, sans dépendance.

// '' → null ; entier en mm → nombre ; virgule, point, lettres → NaN (saisie à corriger).
export function lireMm(v) {
  const s = String(v ?? '').replace(/\s/g, '');
  if (s === '') return null;
  return /^\d+$/.test(s) ? Number(s) : NaN;
}
