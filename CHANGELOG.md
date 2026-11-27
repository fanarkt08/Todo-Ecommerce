# Journal des évolutions

Toutes les évolutions notables du projet sont documentées dans ce fichier.
Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/).

## [Non publié]

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

## [2026-11-27] : mise en production

### Ajouté

- Conteneurisation : Dockerfiles du backend et du frontend (build React servi par nginx), `docker-compose.yml` avec MongoDB.
- Hébergement Hetzner avec deux environnements (préproduction et production), reverse proxy Caddy et certificats HTTPS Let's Encrypt.
- Pipeline CI/CD GitHub Actions : tests, build et publication des images sur GHCR, déploiement automatique (`develop` → préproduction, `master` → production).
- Journalisation structurée (Pino), journal d'audit des actions sensibles, logs d'accès de Caddy et rotation des logs.
- Supervision Prometheus / Grafana et alertes par email (Alertmanager).
- Route `GET /api/health` pour la supervision.
