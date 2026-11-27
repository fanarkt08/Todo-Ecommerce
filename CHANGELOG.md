# Journal des évolutions

Toutes les évolutions notables du projet sont documentées dans ce fichier.
Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) : la section
« Non publié » regroupe ce qui n'est pas encore en production. Chaque version déployée
indique le commit correspondant.

## [Non publié]

Aucune évolution en attente de déploiement.

## [1.2.0] - 2026-11-27

Corrections de sécurité (E28), tests automatisés et documentation générée (E29), déployés en préproduction puis en production (commit `60cf209`).

### Sécurité : failles corrigées (E28)

Failles détectées avec un script d'attaque sur l'API (deux comptes, injections, token
falsifié, requête depuis un site tiers, force brute), `npm audit` et Trivy.
Résultat : **2/12 protections en place avant correction, 12/12 après**, vérifié en local
et à travers nginx avec les images Docker de production.

| # | Faille | Risque | Correction |
|---|---|---|---|
| S1 | **IDOR** : `PUT` et `DELETE /api/tasks/:id` ne vérifiaient pas le propriétaire de la tâche | Tout utilisateur connecté pouvait modifier ou supprimer les tâches des autres en essayant des identifiants | La tâche doit appartenir à l'utilisateur ; sinon 404 (sans révéler qu'elle existe) et événement `task.access_denied` dans le journal d'audit |
| S2 | **XSS / validation des entrées** : HTML et JavaScript (`<img src=x onerror=alert(1)>`) stockés tels quels ; description non contrôlée (taille illimitée, objet → erreur 500) | Exécution de script chez un utilisateur si la donnée est affichée hors de React (export, email, outil d'administration) ; saturation de la base | Balises HTML refusées dans le titre et la description, description limitée à 1 000 caractères et typée ; React échappe déjà le texte affiché |
| S3 | **Content-Security-Policy absente** | Si une faille XSS apparaissait, un script injecté pourrait s'exécuter et envoyer le token à un autre site | CSP stricte servie par nginx (`script-src 'self'`, `connect-src 'self'`, `frame-ancestors 'none'`…), vérifiée sans aucune violation sur tout le parcours |
| S4 | **`JWT_SECRET` faible** (12 caractères en local) et accepté même vide | Un secret court se retrouve par force brute à partir d'un token, ce qui permet de forger des tokens pour n'importe quel compte | Le serveur refuse de démarrer avec moins de 32 caractères ; algorithme `HS256` imposé à la signature et à la vérification ; secrets aléatoires de 128 caractères, différents par environnement |
| S5 | **CORS permissif** : `Access-Control-Allow-Origin: *` | Un site malveillant pouvait appeler l'API depuis le navigateur d'un utilisateur | Aucun site tiers autorisé par défaut (le frontend appelle `/api` sur son propre domaine) ; origines ajoutables via `CORS_ORIGINS` |
| S6 | **Pas de protection contre la force brute** sur la connexion | Essais illimités de mots de passe | 10 échecs maximum par IP en 15 minutes, puis 429 ; événement `auth.rate_limited` dans le journal d'audit |
| S7 | **Dépendances vulnérables** : backend 8 failles (2 critiques : mongoose, express), frontend 67 (3 critiques) | Exploitation de failles connues et publiées | `npm audit fix` : express 4.22.3, mongoose 7.8.14, axios 1.21.1, react-router-dom 6.30.6 ; backend 0 faille, frontend 34 (0 critique, voir risques résiduels) |
| S8 | **Images Docker vulnérables** (Trivy) : backend 19 HIGH/CRITICAL, frontend 70 (nginx 1.27) | Failles du système ou des outils embarqués dans les conteneurs | nginx 1.30.8 + correctifs Alpine, npm retiré de l'image backend : **0 vulnérabilité HIGH/CRITICAL** dans les deux images |
| S9 | **Fuites d'informations techniques** : en-tête `X-Powered-By: Express`, version de nginx, source maps livrées en production | Facilite le ciblage d'une attaque ; le code source complet était téléchargeable | En-tête supprimé, `server_tokens off`, build sans source maps |

Déjà protégé, vérifié par le script : injection NoSQL sur la connexion (`{"$ne": null}`),
bloquée par la validation des champs ajoutée en E27 ; token non signé (`alg: none`) refusé.

**Gestion du `JWT_SECRET` en production** : généré aléatoirement (`openssl rand -hex 64`),
différent pour la production et la préproduction, stocké uniquement dans le `.env` du
serveur (`chmod 600`, envoyé par `scp`), jamais dans Git. Le changer invalide toutes les
sessions en cours (rotation en cas de fuite).

**Risques résiduels acceptés** :
- `react-router` (modérée) : redirection ouverte via une URL fournie par l'utilisateur ; non exploitable ici (uniquement des chemins fixes). Correctif en version 7 (changement majeur) à planifier.
- `react-scripts` (hautes) : outils de compilation (webpack, jest, svgo) absents de l'image de production, qui ne contient que les fichiers statiques. Create React App n'étant plus maintenu, migration vers Vite à prévoir.
- Le token est stocké dans `localStorage` (lisible par un script en cas de XSS) : risque réduit par la validation et la CSP ; un cookie `HttpOnly` serait plus sûr.

### Ajouté

- **Tests automatisés**, lancés à chaque exécution du pipeline :
  - 31 tests de l'API (Jest + Supertest, sur une vraie base MongoDB) : authentification, validation, IDOR, injections HTML et NoSQL, tokens falsifiés, CORS, en-têtes, force brute ;
  - 7 tests des composants React (React Testing Library) : validation des formulaires, messages d'erreur, liens.
  Chaque test renvoie au bug (B…) ou à la faille (S…) qu'il protège contre une régression.
- **Documentation générée à partir du code source** avec JSDoc (`cd backend && npm run docs`) : 19 modules couvrant les routes de l'API (corps attendu, réponses et codes HTTP, événements d'audit, exemples), le middleware, les modèles de données, la configuration et les composants React (rôle, props, bugs corrigés). Elle est générée et publiée à chaque exécution du pipeline (onglet *Artifacts* de GitHub Actions).
- **Contrôles de sécurité bloquants dans le pipeline** : `npm audit` (backend : failles hautes ; frontend : failles critiques) et Trivy (faille critique corrigeable dans une image), qui empêchent le déploiement.
- Instructions du README mises à jour : configuration du `.env`, tests, documentation, Docker.

### Modifié

- Backend découpé en `app.js` (application Express) et `server.js` (démarrage), pour pouvoir tester l'API sans lancer le serveur.
- Comportements de React Router v7 activés à l'avance (`future flags`), pour préparer la migration. Ils ont révélé un défaut latent : les fonctions de connexion et de déconnexion d'`App` étaient recréées à chaque rendu et relançaient le chargement de la page Tâches pendant une déconnexion, qui perdait alors le message « session expirée ». Elles sont désormais stables (`useCallback`).

## [1.1.0] - 2026-11-27

Corrections des bugs (E27), déployées en préproduction puis en production (commit `072e1c4`).

### Corrigé : bugs fonctionnels et d'interface (E27)

Bugs détectés en testant chaque fonctionnalité (inscription, connexion, ajout,
modification, suppression, déconnexion, session expirée) avec un scénario de
test automatisé dans un navigateur, et en appelant l'API sur des cas limites.
Résultat du scénario : **4/18 vérifications réussies avant correction, 18/18 après.**

| # | Bug constaté | Cause | Correction |
|---|---|---|---|
| B1 | Une tâche ajoutée n'apparaît qu'après rechargement de la page | `addTask` dans `Tasks.js` ne mettait pas à jour la liste | La tâche créée est ajoutée en tête de liste (`setTasks`) |
| B2 | Formulaires vides acceptés : titre vide → erreur 500, titre fait d'espaces → ligne vide enregistrée, inscription avec « a » / « x » acceptée | Aucune validation côté interface ni côté API | Validation dans les formulaires et dans l'API (titre obligatoire, 200 caractères max ; nom d'utilisateur de 3 à 30 caractères ; mot de passe de 6 caractères minimum), avec des réponses 400 explicites |
| B3 | Aucun retour à l'utilisateur : erreurs de connexion et d'inscription visibles seulement dans la console, pas de confirmation d'inscription | Les erreurs étaient seulement passées à `console.error` | Messages d'erreur et de succès affichés dans chaque page ; boutons désactivés pendant l'envoi |
| B4 | Impossible de modifier une tâche ou de la marquer comme terminée | La route `PUT /api/tasks/:id` existait mais l'interface ne l'utilisait pas | Boutons « Terminer / Rouvrir » et « Modifier » (édition du titre en place) |
| B5 | Session expirée ou token invalide : page vide, erreur JavaScript non gérée, aucune redirection | L'API renvoyait le code 418 et le chargement des tâches n'avait pas de gestion d'erreur | L'API renvoie 401 ; l'interface déconnecte l'utilisateur et le renvoie vers la connexion avec le message « session expirée » |
| B6 | Après la déconnexion, l'utilisateur reste sur la liste des tâches | `handleLogout` supprimait le token sans changer de page | Redirection vers la page de connexion avec un message de confirmation |
| B7 | Page d'inscription inaccessible depuis l'interface | Aucun lien vers `/register` | Liens « Inscription » dans la barre de navigation et « Créer un compte » sous le formulaire de connexion |
| B8 | Interface incohérente : en-tête en double, bouton « Déconnexion » sans style, pages en anglais et en français, année figée à 2025 | `<header>` imbriqué dans `App.js`, styles manquants, textes non traduits | Un seul en-tête de 60 px, bouton stylé comme les liens, interface et messages de l'API en français, année calculée automatiquement |
| B9 | Un identifiant de tâche mal formé provoque une erreur 500 au lieu de 404 | `findById` lève une erreur de conversion sur un identifiant invalide | Vérification de l'identifiant (`isValidObjectId`) avant la requête, réponse 404 « Tâche introuvable » |

### Modifié

- Messages de l'API traduits en français et affichés tels quels dans l'interface.
- `findByIdAndRemove` (déprécié, supprimé dans Mongoose 8) remplacé par `findByIdAndDelete`.
- La modification d'une tâche ne met à jour que les champs envoyés, après validation.

## [1.0.0] - 2026-11-27

Première mise en production (commit `c09b013`).

### Ajouté

- Conteneurisation : Dockerfiles du backend et du frontend (build React servi par nginx), `docker-compose.yml` avec MongoDB.
- Hébergement Hetzner avec deux environnements (préproduction et production), reverse proxy Caddy et certificats HTTPS Let's Encrypt.
- Pipeline CI/CD GitHub Actions : tests, build et publication des images sur GHCR, déploiement automatique (`develop` → préproduction, `master` → production).
- Journalisation structurée (Pino), journal d'audit des actions sensibles, logs d'accès de Caddy et rotation des logs.
- Supervision Prometheus / Grafana et alertes par email (Alertmanager).
- Route `GET /api/health` pour la supervision.

[Non publié]: https://github.com/fanarkt08/Todo-Ecommerce/compare/60cf209...develop
[1.2.0]: https://github.com/fanarkt08/Todo-Ecommerce/compare/072e1c4...60cf209
[1.1.0]: https://github.com/fanarkt08/Todo-Ecommerce/compare/c09b013...072e1c4
[1.0.0]: https://github.com/fanarkt08/Todo-Ecommerce/commit/c09b013
