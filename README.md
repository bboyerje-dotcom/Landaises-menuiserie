# Pilotage Terrain — Landaise de Menuiserie (test interne)

Outil de relevé terrain complémentaire à ProDevis.
- **Étape 1** : dossier client/chantier.
- **Étape 2** : relevé guidé fenêtre / porte-fenêtre (cotes mm, point de vue, sens vu de l'intérieur, type de pose confirmé, contrôles, statut COMPLET / À VÉRIFIER, versions).
- **Étape 3** : photos par ouvrage (4 catégories, extérieure + intérieure obligatoires), compression 1600 px, métadonnées/GPS supprimées, doublons refusés, légendes, sauvegarde JSON avec photos.
- **Étape 4** : document « Relevé de chantier » imprimable en PDF (synthèse + une page par ouvrage + cadre de validation technique) et export Excel (CSV) pour la ressaisie dans ProDevis. Exemples fictifs dans `docs/exemples/`.
- **Étape 5** : aide à la prise de cotes. Catalogue illustré de 20 produits (menuiseries, portes de garage, volets, stores, portails, pergolas, carport), tableau de métrage par produit, **cotes dessinées sur la photo** avec code couleur (largeur bleu, hauteur rouge, retour d’habillage vert, tapée violet, recouvrement orange, profondeur bleu-vert, pente framboise), ajustables au doigt, inversion gauche/droite signalée, calcul de pente, guide des relevés.
Les données restent **uniquement sur l'appareil** (IndexedDB du navigateur). Aucun serveur, aucun envoi.

## Lancer
Prérequis : Node.js 20+ (aucune autre installation).

    npm start            # http://localhost:8080 sur le PC
    npm run start:lan    # accessible depuis un smartphone du même Wi-Fi : http://<IP-du-PC>:8080

## Tester
    npm test             # règles métier (48 tests)
    npm run test:e2e     # navigateur réel, écran → stockage (51 tests ; nécessite Playwright + Chromium)

## Structure
- `js/config/regles.js` : **seuils de contrôle PROVISOIRES — à valider par le responsable technique**
- `js/domain/dossier.js` : règles métier pures (validation, référence, doublons)
- `js/domain/ouvrage.js` : règles du relevé (manques, alertes, statut, cotes retenues)
- `js/ui/ouvrage.js` : écran de relevé guidé (schéma, sens, aperçu du statut)
- `js/domain/photo.js`, `js/media/image.js`, `js/ui/photos.js` : photos (règles, compression, écran)
- `js/config/export-prodevis.js` : **colonnes de l'export ProDevis — ordre PROVISOIRE, à réordonner selon l'écran ProDevis**
- `js/domain/export.js`, `js/ui/releve.js` : export tableur et document de relevé
- `js/catalogue/produits.js` : **catalogue des produits (schémas, cotes, options, poses) — V1 À VALIDER par le responsable technique**
- `js/catalogue/types-cotes.js` : code couleur des cotes
- `js/domain/catalogue.js`, `js/ui/ouvrage-catalogue.js`, `js/ui/photo-cotes.js`, `js/ui/dessin.js`, `js/ui/guide.js`, `js/ui/choix-produit.js` : relevé guidé générique et cotes sur photo
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
- Photos stockées sur l'appareil : prévoir l'espace (≈ 200–400 Ko par photo) et exporter régulièrement.
- Pas encore d'annotation dessinée sur les photos ni de croquis (étape ultérieure).
- L'export est un fichier CSV (ouvert par Excel) : pas d'import automatique dans ProDevis tant que ses capacités d'import ne sont pas confirmées.
- Le PDF passe par l'impression du navigateur (« Enregistrer au format PDF »).
