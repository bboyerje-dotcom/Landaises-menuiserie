# Pilotage Terrain — Landaise de Menuiserie (test interne)

Outil de relevé terrain complémentaire à ProDevis. **Étape 1 : dossier client/chantier.**
Les données restent **uniquement sur l'appareil** (IndexedDB du navigateur). Aucun serveur, aucun envoi.

## Lancer
Prérequis : Node.js 20+ (aucune autre installation).

    npm start            # http://localhost:8080 sur le PC
    npm run start:lan    # accessible depuis un smartphone du même Wi-Fi : http://<IP-du-PC>:8080

## Tester
    npm test             # règles métier (10 tests)
    npm run test:e2e     # navigateur réel, écran → stockage (8 tests ; nécessite Playwright + Chromium)

## Structure
- `js/domain/dossier.js` : règles métier pures (validation, référence, doublons)
- `js/storage/db.js` : stockage local, création idempotente, brouillon
- `js/app.js` : écrans (liste, nouveau dossier, détail)
- `tests/` : tests unitaires et de bout en bout

## Limites connues de l'étape 1
- Pas de comptes ni de droits : une personne, un appareil. Protection = verrouillage du téléphone.
- Les références `LDM-AAMMJJ-NNN` sont uniques **par appareil** (deux téléphones peuvent produire la même).
- Effacer les données du navigateur efface les dossiers : utiliser « Exporter une sauvegarde ».
- Ne jamais mettre de grille tarifaire ou de prix d'achat dans le code (il pourrait être hébergé).
