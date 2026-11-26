// Construction de l'export tableur. Module pur, testé avec `node --test`.

// Protection contre l'injection de formule : une cellule commençant par = + - @ (ou tab/retour)
// serait exécutée par Excel. On la préfixe d'une apostrophe. Les nombres restent des nombres.
export function celluleSure(v) {
  if (v == null) return '';
  if (typeof v === 'number') return String(v);
  const s = String(v);
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}

// CSV compatible Excel français : séparateur « ; », guillemets doublés, fins de ligne CRLF,
// BOM UTF-8 pour que les accents s'affichent correctement à l'ouverture.
export function versCsv(entetes, lignes) {
  const champ = (v) => {
    const s = celluleSure(v);
    return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + [entetes, ...lignes].map((l) => l.map(champ).join(';')).join('\r\n') + '\r\n';
}

export function lignesExport(colonnes, dossier, ouvrages, extras = {}) {
  return {
    entetes: colonnes.map((c) => c.entete),
    lignes: ouvrages.map((o) => colonnes.map((c) => c.valeur(o, dossier, extras[o.id] || {}))),
  };
}

export const nomFichier = (dossier, suffixe, ext, maintenant = new Date()) => {
  const p = (n) => String(n).padStart(2, '0');
  const h = `${maintenant.getFullYear()}${p(maintenant.getMonth() + 1)}${p(maintenant.getDate())}-${p(maintenant.getHours())}${p(maintenant.getMinutes())}`;
  return `${dossier.reference}_${suffixe}_${h}.${ext}`;
};
