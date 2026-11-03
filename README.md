# Fold Studio Lab

Atelier de pliage dans le navigateur : packaging paramétrique, origami, pop-up, spirogami et dépliage de maillages OBJ.

**[Utiliser Fold Studio](https://etienne.design/tools/FoldStudio/)**

Édition publique sans compte, sans serveur applicatif et sans fonctions IA. Les calculs géométriques et les exports sont effectués dans le navigateur. Le travail courant reste en mémoire : utilisez **Save project** avant de fermer la page, puis **Open project** pour retrouver paramètres, géométrie et images. Ces fichiers locaux `.foldstudio.json` couvrent packaging, origami, pop-up et spirogami (16 MiB maximum). Unfold conserve ses exports séparés.

## Installation locale

Prérequis : Node.js 22 et npm.

```sh
npm ci --legacy-peer-deps --ignore-scripts
npm run dev
```

## Compilation

```sh
npm run build
npm run preview
```

Pour un hébergement sous un préfixe :

```sh
npm run build -- --base=/tools/FoldStudio/
```

Publier uniquement `dist/`. Configurer le serveur pour renvoyer `index.html` sur les routes de l'application. Ne jamais publier `env.json`, les sources serveur ou `node_modules/`.

## Fonctionnalités

- Packaging : dimensions paramétriques, patrons 2D, aperçu du pliage en 3D.
- Origami : motifs de plis et bibliothèque de modèles.
- Pop-Up : mécanismes et ouverture animée du livre.
- Spirogami : sculptures de papier en spirale.
- Unfold : import de maillages OBJ.
- Exports SVG, PDF et JSON `.fold` ; outils de matériaux et d'illustration.

Les calculs et exports nécessitent une validation adaptée avant fabrication. L'extension `.fold` utilise ici les propriétés internes camelCase du moteur ; elle ne garantit pas une conformité complète au standard FOLD externe.

## Architecture

React, TypeScript, Vite, Three.js / React Three Fiber, pdfmake. Sources initiales créées avec Floot, adaptées pour un hébergement statique autonome.

`pages/` contient les ateliers, `helpers/` les moteurs et exporteurs, `components/` les interfaces. Les fichiers historiques `server.ts`, `endpoints/`, `loadEnv.js` et helpers d'authentification/IA restent dans les sources pour traçabilité mais ne sont pas nécessaires à cette édition. Ne pas les exposer comme backend prêt pour la production.

## Vérifications

Chargement des cinq ateliers testé dans Chrome sur le site public. Exports packaging SVG, PDF et `.fold` réellement téléchargés et structurellement vérifiés. Tous les modèles et imports n'ont pas été testés exhaustivement.

Exécuter `npm test` pour les contrôles de typage, géométrie, import/export, projets, commandes et transaction de publication. Puppeteer est verrouillé dans les dépendances de développement ; installer son navigateur avec `npx puppeteer browsers install chrome` ou définir `PUPPETEER_EXECUTABLE_PATH`. Les scripts `verify.mjs` et `verify-interactions.mjs` acceptent `PAGE_URL`; les tests UI acceptent `UI_URL`. Voir `QUALITY-REVIEW.md` pour les commandes et limites. Les preuves générées restent exclues de Git.

## Déploiement du site de démonstration

Les scripts sous `deploy/` ciblent l'infrastructure du propriétaire ; ils ne doivent pas être exécutés tels quels sur un autre serveur. Adaptez hôte SSH, chemins et configuration nginx. Le lien de release est propre à Fold Studio. `integration/tools-hub/` conserve la carte et son illustration pour le hub, pas les sources complètes du hub.

## Limites et sécurité

Cette édition n'utilise aucune clé API ni base de données. Les dépendances serveur dormantes et les polyfills Node ont été retirés du manifeste frontend ; React Router a été mis à jour. L’audit npm de cette révision ne signale aucune vulnérabilité connue : ce n’est pas un audit de sécurité exhaustif. La CSP de la démonstration reste sans `unsafe-eval` ; un essai d’évaluation bloqué est encore observé pendant l’export PDF, sans empêcher le téléchargement vérifié. Les familles Rings/Waves sont explicitement expérimentales et non rigides. Aucune certification de fabrication n’est revendiquée.

## Licence

Code du projet : MIT, © 2026 Étienne Mineur. Les bibliothèques et polices conservent leurs licences propres ; voir `THIRD_PARTY_NOTICES.md`.
