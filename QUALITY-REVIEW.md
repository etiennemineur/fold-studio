# Fold Studio — bilan de la passe de qualité

## Livraison

Révision publiée sur https://etienne.design/tools/FoldStudio/ et conservée dans `~/Developer/Fold Studio/web/`. Release `foldstudio-20261103-132156-74163771`. L’archive d’origine et le simulateur fourni restent intacts. Les fichiers privés et preuves volumineuses ne sont pas destinés à GitHub.

Prévisualisation de cette version : http://127.0.0.1:4198/tools/FoldStudio/

## Améliorations vérifiées

### Géométrie
- Changer la face de repos conserve maintenant l’assemblage plié, y compris avec le double rainurage.
- Une boîte avec pattes de collage de largeur nulle ne génère plus quatre panneaux dégénérés.
- Les jonctions planes ne consomment plus de créneau dans l’animation séquentielle.
- Tests sur les 20 familles ; les tests distinguent explicitement les 18 familles rigides des deux familles expérimentales décrites ci-dessous.

### Ergonomie
- Commandes communes aux cinq ateliers : plier/déplier, lecture/pause, remise à zéro de l’animation, vitesse et curseur utilisable au clavier. Pour Pop-Up, les extrémités correspondent à fermer/ouvrir le livre.
- Pause/reprise conserve le sens ; lecture arrêtée aux extrémités et lors du passage de l’onglet en arrière-plan.
- Correction supplémentaire du démarrage de l’horloge : le premier timestamp requestAnimationFrame pouvait précéder performance.now() et arrêter immédiatement la lecture. Régression déterministe ajoutée, puis suite navigateur complète relancée sans assouplir les assertions.
- À 390 px, panneaux empilés et navigation visible au lieu de colonnes trop étroites.
- Les échecs d’import SVG affichent un message et conservent le patron courant ; fichiers SVG limités à 10 MiB.
- Delete/Backspace ne supprime plus un pli pendant une saisie dans un contenu éditable.

### Import, images et export
- Échelle physique des SVG respectée ; intersections/jonctions en T subdivisées ; plis noirs pointillés reconnus ; faces extérieures éliminées pour chaque pièce indépendante.
- XML, chemins invalides, coordonnées non finies, plans vides et indices OBJ incohérents rejetés.
- Réimport des SVG exportés sans agrandissement causé par les repères d’impression.
- Titres échappés dans les exports SVG packaging et Pop-Up.
- Les images dupliquées restent disponibles après suppression de l’original ; une image en cours de lecture ne réapparaît plus après remise à zéro.
- Rotation des images prise en compte dans les PDF ; rasterisation bornée à 4096 px, 300 dpi visés. Le PDF et les tracés restent en dimensions physiques.
- Une image indisponible provoque un échec PDF explicite au lieu d’une attente indéfinie.
- Le validateur Pop-Up ne déclare plus valide un document lorsque le solveur échoue.

### Dernières corrections intégrées
- Save project / Open project : fichier versionné `.foldstudio.json`, paramètres, géométrie et images embarquées pour les quatre modes Studio ; 16 MiB maximum. Validation stricte et erreurs non destructives. Réouverture après rechargement vérifiée avec pixels des images.
- Texture composite plafonnée réellement à 2048 px et dispose enregistré au remplacement/démontage ; pas de mesure de mémoire GPU.
- Paramètres Spirogami bornés dans les champs et les générateurs ; Force Re-unfold relance réellement le solveur.
- About décrit l’édition statique ; Rings/Waves affichent leur limitation non rigide.
- Routes et PDF chargés à la demande, dépendances serveur dormantes/polyfills Node retirés, React Router mis à jour.
- Déploiement par lien propre et bascule atomique avec verrou, checksum et rollback automatique sur échec ; aucune réécriture du nginx partagé.

## Preuves exécutées sur l’état intégré

- `npm run typecheck` : succès sur le graphe frontend.
- `tsx --test tests/geometry/*.test.ts` : 9 tests réussis.
- Suites imports/exports/images et test d’horloge : réussis. Rotation à 90° vérifiée par dimensions, pixels rouge/bleu et création d’un vrai PDF.
- Build Vite de production sous `/tools/FoldStudio/` : réussi.
- Tests navigateur : cinq ateliers à 1440 et 390 px, soit dix combinaisons ; commandes exercées, pause/reprise/vitesse, import OBJ, changement des pixels de rendu vérifiés.
- Tests d’erreur SVG et de saisie : réussis.
- Cinq routes : aucune erreur JavaScript/réseau collectée, aucune requête externe observée.
- Téléchargements SVG/PDF/FOLD nouveaux, XML/JSON/signature PDF contrôlés.
- `git diff --check` : réussi.

Comparaison reproductible avec le simulateur fourni : son exemple Étui donne 13 panneaux et 12 charnières ; Fold Studio reconstruit également 13 panneaux et 12 plis. Les blocs Mailer MODEL/ENGINE ont aussi été sondés par le lot géométrique ; ne pas confondre des poses échantillonnées avec une garantie continue.

## Ce qui empêche de parler d’application « parfaite »

1. **Anneaux et vagues :** la cinématique actuelle déforme certaines faces. Ces deux familles ne sont pas des solutions de pliage rigide validées. Il faut un solveur de contraintes pour les cycles ou une représentation différente.
2. **Fabrication :** collisions coplanaires, épaisseur, compression et fermeture réelle ne sont pas validées exhaustivement. Aucun prototype papier/carton fabriqué pendant cette passe.
3. **Sauvegarde :** fichiers projet disponibles pour les quatre modes Studio, sans autosauvegarde et sans projet restaurable Unfold. Les images doivent être décodables et ne pas dépasser 4096 × 4096 px ; fichier complet limité à 16 MiB.
4. **Import SVG :** sous-ensemble de SVG, pas une interprétation complète de CSS, `use`, trous imbriqués et conventions industrielles. Les OBJ restent normalisés à 100 mm comme auparavant.
5. **PDF/CSP :** le navigateur signale encore une tentative `script-src:eval` bloquée lors de l’export PDF. Le PDF testé est néanmoins téléchargé et valide ; la CSP n’a pas été affaiblie.
6. **Dépendances :** audit npm final, toutes dépendances et production : zéro avis connu. Cela ne constitue pas un audit de sécurité exhaustif.
7. **Chargement :** JavaScript nécessaire au Studio ≈ 2,57 Mo, ≈ 0,724 Mo gzip, hors CSS/polices. Le moteur PDF et ses polices (≈ 2,21 Mo JS) ne sont plus chargés avant export, vérifié sur le site. Le chunk 3D reste volumineux et déclenche l’avertissement Vite.
8. **Accessibilité :** vérification Chromium desktop et viewport mobile, pas de test sur téléphone physique ni campagne complète lecteur d’écran.

## Rejouer les vérifications

`npm ci --legacy-peer-deps --ignore-scripts`, puis installer le navigateur de test avec `npx puppeteer browsers install chrome` ou fournir `PUPPETEER_EXECUTABLE_PATH`.

- `npm test` : typage, géométrie, imports/exports/images, horloge, schéma projet, runtime et transaction de publication.
- `npm run build -- --base=/tools/FoldStudio/`
- `npm run preview -- --port 4198 --strictPort --base=/tools/FoldStudio/`
- `UI_URL=http://127.0.0.1:4198/tools/FoldStudio node tests/ui/ergonomics.mjs`
- `UI_URL=http://127.0.0.1:4198/tools/FoldStudio/studio node tests/ui/import-errors.mjs`
- `UI_URL=http://127.0.0.1:4198/tools/FoldStudio/studio node tests/ui/editing-keys.mjs`
- `PAGE_URL=http://127.0.0.1:4198/tools/FoldStudio/ node verify.mjs`
- `PAGE_URL=http://127.0.0.1:4198/tools/FoldStudio/ node verify-interactions.mjs`

- `UI_URL=http://127.0.0.1:4198/tools/FoldStudio/studio node tests/projects/roundtrip-browser.mjs`
- `node tests/deploy/public-assets.mjs` : contrôle du site public contre les fichiers de `dist/`.

## Vérification de publication

Les cinq ateliers publics se chargent sans erreur JavaScript collectée. Exports SVG/PDF/FOLD réellement téléchargés. Les quatre modes passent le cycle sauvegarder → recharger la page → ouvrir, avec images décodées et rejet non destructif des fichiers invalides. Les 30 assets publics comparés par SHA-256 correspondent au build local ; références d’entrée identiques malgré l’injection SEO du serveur. `/`, `/tools/` et l’adresse courte `/foldstudio` répondent en 200 après redirection. Le script SEO de même origine `/seo/adresses.js` est ajouté par l’hébergement, sans backend de données du Studio.

Les rapports détaillés et preuves locales sont dans `verification/` (`public-release-*`, `public-assets/result.json`, `public-deploy/`). Les tests durables sont dans `tests/`.
