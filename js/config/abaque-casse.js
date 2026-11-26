// Abaque interne de remplacement de casse — repris À L'IDENTIQUE du document LDM
// « REMPLACEMENT DE CASSE » du 27/04/2022 (cotes côté parcloses).
// CDV = clair de vitre ; FF = fond de feuillure. dL / dH : écart à ajouter (mm).
// ⚠ Résultat INDICATIF : la cote de commande du vitrage reste à valider.
export const SOURCE_ABAQUE = 'Abaque interne LDM « Remplacement de casse » du 27/04/2022';

export const SERIES_CASSE = {
  // TECHNAL
  fc:      { libelle: 'TECHNAL FC', base: 'CDV', dL: 31, dH: 31 },
  fb_fbi:  { libelle: 'TECHNAL FB / FBI', base: 'CDV', dL: 25, dH: 25, epaisseur: 24 },
  fy:      { libelle: 'TECHNAL FY', base: 'CDV', dL: 32, dH: 32, epaisseur: 24 },
  gm:      { libelle: 'TECHNAL GM', base: 'CDV', dL: 22, dH: 22, epaisseur: 24 },
  gk_dv:   { libelle: 'TECHNAL GK (double vitrage)', base: 'CDV', dL: 22, dH: 22, epaisseur: 24 },
  gk_sv:   { libelle: 'TECHNAL GK (simple vitrage)', base: 'CDV', dL: 16, dH: 16 },
  gb_gbi:  { libelle: 'TECHNAL GB / GBI', base: 'CDV', dL: 24, dH: 24, epaisseur: 24 },
  gx_gxi:  { libelle: 'TECHNAL GX / GXI', base: 'CDV', dL: 27, dH: 23, epaisseur: 24 },
  gy:      { libelle: 'TECHNAL GY', base: 'CDV', dL: 28, dH: 28, epaisseur: 24 },
  pl:      { libelle: 'TECHNAL PL (parcloses de 20)', base: 'CDV', dL: 20, dH: 20, epaisseur: 24 },
  ph:      { libelle: 'TECHNAL PH', base: 'CDV', dL: 27, dH: 27, epaisseur: 24 },
  pb_pbi:  { libelle: 'TECHNAL PB / PBI', base: 'CDV', dL: 25, dH: 25, epaisseur: 24 },
  py:      { libelle: 'TECHNAL PY', base: 'CDV', dL: 32, dH: 32, epaisseur: 24 },
  // Non TECHNAL
  bois:           { libelle: 'Bois', base: 'CDV', dL: 22, dH: 22, alternative: { base: 'FF', d: -6 } },
  pvc:            { libelle: 'PVC', base: 'CDV', plage: [30, 35] },
  alu_frappe:     { libelle: 'Alu frappe', base: 'FF', dL: -8, dH: -8 },
  alu_coulissant: { libelle: 'Alu coulissant', base: 'CDV', sansRegle: true },
  pe:             { libelle: 'PE', base: 'CDV', sansRegle: true, epaisseur: 24 },
  ppm:            { libelle: 'PPM', base: 'CDV', sansRegle: true, epaisseur: 24 },
};

// Épaisseurs des verres (mm). Feuilletés : valeurs du document (33.2 = 6,8 ; 44.2 = 8,8 ; SP510 ou 44/6 = 10,3).
export const VERRES = {
  v3: { libelle: '3 mm', e: 3 }, v4: { libelle: '4 mm', e: 4 }, fe4: { libelle: '4 mm faible émissif (FE)', e: 4 },
  v5: { libelle: '5 mm', e: 5 }, v6: { libelle: '6 mm', e: 6 }, v8: { libelle: '8 mm', e: 8 }, v10: { libelle: '10 mm', e: 10 },
  f332: { libelle: 'Feuilleté 33.2', e: 6.8 }, f442: { libelle: 'Feuilleté 44.2', e: 8.8 }, sp510: { libelle: 'Feuilleté SP510 ou 44/6', e: 10.3 },
};
export const INTERCALAIRES = {
  sv: { libelle: 'Aucun (simple vitrage)', e: 0 }, i6: { libelle: '6 mm', e: 6 }, i8: { libelle: '8 mm', e: 8 }, i10: { libelle: '10 mm', e: 10 },
  i12: { libelle: '12 mm', e: 12 }, i14: { libelle: '14 mm', e: 14 }, i15: { libelle: '15 mm', e: 15 }, i16: { libelle: '16 mm', e: 16 },
  i18: { libelle: '18 mm', e: 18 }, i20: { libelle: '20 mm', e: 20 },
};
export const TOLERANCE_EPAISSEUR_MM = 0.5; // écart toléré entre épaisseur mesurée et composition
export const ECART_NETTE_RELEVEE_MM = 3;   // PROVISOIRE : écart toléré entre cote nette relevée et abaque
