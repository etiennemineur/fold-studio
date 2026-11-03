# Corrections runtime bornées — vérifications

## Commandes exécutées avec succès
Depuis `~/Developer/Fold Studio/web` :

```sh
# Install the isolated test browser, or set PUPPETEER_EXECUTABLE_PATH.
npx puppeteer browsers install chrome
node --test tests/final-runtime/*.test.mjs
node --import tsx --test tests/final-runtime/spiro.test.ts
node tests/final-runtime/spiro-ui.mjs
node tests/final-runtime/reunfold.mjs
npm test
```

- Tests ajoutés avant corrections et observés en échec : canvas 10000 px malgré plafond, cleanup absent, paramètres générateurs non bornés, attributs numériques min/max absents, Force Re-unfold appelle le solveur une seule fois, textes trompeurs/About et avertissements absents.
- Résultat : 4 tests source/contrat + 3 tests générateurs réussis ; 7 champs réels Spirogami bornés en Chromium ; import OBJ et second appel du vrai meshUnfolder après clic vérifiés ; suite `npm test` complète réussie.
- La sonde composite exécute le bloc source avec canvas/texture/hooks contrôlés : vérifie allocation et enregistrement cleanup, pas une mesure de mémoire GPU. Les tests de texte lisent les sources, pas une validation visuelle.
- Le test Unfolder compile la vraie page et instrumente uniquement un compteur à l'entrée du vrai solveur. Origine HTTP interceptée pour permettre localStorage ; aucun serveur partagé redémarré.
- Rings/Waves restent explicitement non rigides ; aucun seuil géométrique assoupli. Aucune certification de fabrication.
- Aucun changement dans studio.tsx, useArtworkLayers.tsx, exporters, package, publication ou Git par cette passe. Aucun build/release effectué ici.

## Fichiers applicatifs modifiés

- `components/StudioFoldedGeometry.tsx` : emplacement réel de la texture composite (aucun useCompositeTexture.tsx), plafond effectif 2048 px par dimension et dispose au remplacement/démontage.
- `helpers/spirogamiEngine.tsx` : normalisation partagée, appliquée aux deux générateurs, valeurs non finies remplacées, tours limités à 10, résolution entière limitée à 128 segments/tour ; progression bornée.
- `components/StudioSpiroSidebar.tsx` : callback normalisé, bornes HTML des sept champs.
- `pages/unfolder.tsx` : révision explicite invalidant l'effet de calcul.
- `components/AppLayout.tsx` : édition navigateur sans comptes/IA, retrait des services dormants annoncés, limites fabrication.
- `components/StudioPackagingSidebar.tsx` : labels expérimentaux non rigides et avertissement conditionnel. Aucune insertion supplémentaire dans studio.tsx nécessaire.
