# Pilotage Terrain — Landaise de Menuiserie (test interne)

Outil de relevé terrain complémentaire à ProDevis.
- **Étape 1** : dossier client/chantier.
- **Étape 2** : relevé guidé fenêtre / porte-fenêtre (cotes mm, point de vue, sens vu de l'intérieur, type de pose confirmé, contrôles, statut COMPLET / À VÉRIFIER, versions).
Les données restent **uniquement sur l'appareil** (IndexedDB du navigateur). Aucun serveur, aucun envoi.

## Lancer
Prérequis : Node.js 20+ (aucune autre installation).

    npm start            # http://localhost:8080 sur le PC
    npm run start:lan    # accessible depuis un smartphone du même Wi-Fi : http://<IP-du-PC>:8080

## Tester
    npm test             # règles métier (26 tests)
    npm run test:e2e     # navigateur réel, écran → stockage (20 tests ; nécessite Playwright + Chromium)

## Structure
- `js/config/regles.js` : **seuils de contrôle PROVISOIRES — à valider par le responsable technique**
- `js/domain/dossier.js` : règles métier pures (validation, référence, doublons)
- `js/domain/ouvrage.js` : règles du relevé (manques, alertes, statut, cotes retenues)
- `js/ui/ouvrage.js` : écran de relevé guidé (schéma, sens, aperçu du statut)
- `js/storage/db.js` : stockage local, création idempotente, brouillon
- `js/app.js` : écrans (liste, nouveau dossier, détail)
- `tests/` : tests unitaires et de bout en bout

## Limites connues
- Pas de comptes ni de droits : une personne, un appareil. Protection = verrouillage du téléphone.
- Les références `LDM-AAMMJJ-NNN` sont uniques **par appareil** (deux téléphones peuvent produire la même).
- Effacer les données du navigateur efface les dossiers : utiliser « Exporter une sauvegarde ».
- Ne jamais mettre de grille tarifaire ou de prix d'achat dans le code (il pourrait être hébergé).
- Seuils de contrôle provisoires tant que `REGLES.valide` vaut `false` (bandeau affiché).
- Le statut VALIDÉ TECHNIQUEMENT n'est pas encore attribuable (nécessite des rôles).
