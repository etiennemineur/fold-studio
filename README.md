# Fold Studio Lab

Atelier de pliage dans le navigateur : packaging paramétrique, origami, pop-up, spirogami et dépliage de maillages OBJ.

**[Utiliser Fold Studio](https://etienne.design/tools/FoldStudio/)**

Édition publique sans compte, sans serveur applicatif et sans fonctions IA. Les calculs géométriques et les exports sont effectués dans le navigateur. Le travail courant reste en mémoire : exportez vos documents avant de fermer la page.

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

Les scripts `verify.mjs` et `verify-interactions.mjs` utilisent Puppeteer (installer à part avec `npm install --no-save --package-lock=false --legacy-peer-deps puppeteer`). Le second vise le site de démonstration public. Les résultats générés restent exclus de Git.

## Déploiement du site de démonstration

Les scripts sous `deploy/` ciblent l'infrastructure du propriétaire ; ils ne doivent pas être exécutés tels quels sur un autre serveur. Adaptez hôte SSH, chemins et configuration nginx. Le lien de release est propre à Fold Studio. `integration/tools-hub/` conserve la carte et son illustration pour le hub, pas les sources complètes du hub.

## Limites et sécurité

Cette édition n'utilise aucune clé API ni base de données. L'export d'origine conserve des dépendances historiques non utilisées côté navigateur. L'audit npm a signalé des avis concernant notamment Kysely (backend non publié), React Router et des polyfills ; ce dépôt ne revendique pas un audit de sécurité exhaustif. La CSP de la démonstration reste sans `unsafe-eval` ; un essai d'évaluation bloqué a été observé pendant les exports, sans empêcher les fichiers testés d'être produits.

## Licence

Code du projet : MIT, © 2026 Étienne Mineur. Les bibliothèques et polices conservent leurs licences propres ; voir `THIRD_PARTY_NOTICES.md`.
