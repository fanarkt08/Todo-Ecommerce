/**
 * Routes des tâches, montées sur `/api/tasks` (voir app.js).
 * Toutes exigent un token valide dans l'en-tête `x-auth-token` (middleware auth) :
 * sans token ou avec un token invalide ou expiré, la réponse est `401 { msg }`.
 * Un utilisateur n'accède qu'à ses propres tâches.
 * @module routes/tasks
 */
const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const auth = require('../middleware/auth');
const Task = require('../models/Task');
const { audit } = require('../config/logger');

const TITLE_MAX_LENGTH = 200;
const DESCRIPTION_MAX_LENGTH = 1000;
const TASK_NOT_FOUND = { msg: 'Tâche introuvable.' };
const HTML_TAG = /<[^>]*>/;

/**
 * Valide le titre d'une tâche.
 * Bug corrigé (E27) : un titre vide provoquait une erreur 500 et un titre composé
 * d'espaces était enregistré (ligne vide dans la liste).
 * Faille corrigée (E28) : du HTML/JavaScript (ex. <img src=x onerror=alert(1)>) était
 * stocké tel quel. React l'affiche comme du texte, mais tout autre affichage (export,
 * email, outil d'administration) l'exécuterait : il est refusé à l'entrée.
 * @returns {string|null} message d'erreur, ou null si le titre est valide
 */
function validateTitle(title) {
  if (typeof title !== 'string' || !title.trim()) return 'Le titre de la tâche est obligatoire.';
  if (title.trim().length > TITLE_MAX_LENGTH) return `Le titre ne doit pas dépasser ${TITLE_MAX_LENGTH} caractères.`;
  if (HTML_TAG.test(title)) return "Le HTML n'est pas autorisé dans le titre.";
  return null;
}

/**
 * Valide la description (facultative).
 * Faille corrigée (E28) : la description n'était pas contrôlée (HTML/script stocké,
 * texte de taille illimitée, objet provoquant une erreur 500).
 * @returns {string|null} message d'erreur, ou null si la description est valide
 */
function validateDescription(description) {
  if (description === undefined || description === null || description === '') return null;
  if (typeof description !== 'string') return 'La description doit être un texte.';
  if (description.length > DESCRIPTION_MAX_LENGTH) return `La description ne doit pas dépasser ${DESCRIPTION_MAX_LENGTH} caractères.`;
  if (HTML_TAG.test(description)) return "Le HTML n'est pas autorisé dans la description.";
  return null;
}

/**
 * Récupère une tâche de l'utilisateur connecté, ou répond 404.
 * Faille corrigée (E28, IDOR) : n'importe quel utilisateur connecté pouvait modifier
 * ou supprimer la tâche d'un autre en connaissant son identifiant. La tâche d'un autre
 * utilisateur est maintenant traitée comme inexistante (404, sans révéler qu'elle
 * existe) et la tentative est inscrite au journal d'audit.
 * @returns {Promise<object|null>} la tâche, ou null si une réponse 404 a été envoyée
 */
async function findOwnTask(req, res) {
  const task = await Task.findById(req.params.id);
  if (!task) {
    res.status(404).json(TASK_NOT_FOUND);
    return null;
  }
  if (String(task.user) !== req.user.id) {
    audit(
      req,
      'task.access_denied',
      { userId: req.user.id, taskId: String(task._id), ownerId: String(task.user), reason: 'not_owner' },
      'warn'
    );
    res.status(404).json(TASK_NOT_FOUND);
    return null;
  }
  return task;
}

/**
 * **GET /api/tasks** : liste les tâches de l'utilisateur connecté, les plus récentes d'abord.
 *
 * Réponses : `200 [{ _id, title, description, isCompleted, createdAt, user }]`,
 * `401` sans token valide, `500` en cas d'erreur serveur.
 *
 * @name listTasks
 * @function
 * @memberof module:routes/tasks
 * @param {express.Request} req - `req.user.id` est fourni par le middleware auth
 * @param {express.Response} res
 */
router.get('/', auth, async (req, res) => {
  try {
    const tasks = await Task.find({ user: req.user.id }).sort({ createdAt: -1 });
    res.json(tasks);
  } catch (err) {
    req.log.error({ err }, 'Erreur lors de la lecture des tâches');
    res.status(500).send('Server Error');
  }
});

/**
 * **POST /api/tasks** : crée une tâche pour l'utilisateur connecté.
 *
 * Corps JSON attendu : `{ "title": string, "description"?: string }`
 * - `title` : obligatoire, 200 caractères maximum, sans balise HTML (espaces de début et fin retirés) ;
 * - `description` : facultative, texte de 1 000 caractères maximum, sans balise HTML.
 *
 * Réponses : `200` la tâche créée, `400 { msg }` si un champ est invalide, `401` sans
 * token valide, `500` en cas d'erreur serveur.
 * Journal d'audit : `task.create`.
 *
 * @name createTask
 * @function
 * @memberof module:routes/tasks
 * @param {express.Request} req
 * @param {express.Response} res
 * @example
 * curl -X POST https://todo-ecommerce.duckdns.org/api/tasks \
 *   -H "Content-Type: application/json" -H "x-auth-token: <token>" -d '{"title":"Acheter du pain"}'
 * // => 200 {"_id":"...","title":"Acheter du pain","isCompleted":false,...}
 */
router.post('/', auth, async (req, res) => {
  const { title, description } = req.body;

  const error = validateTitle(title) || validateDescription(description);
  if (error) return res.status(400).json({ msg: error });

  try {
    const newTask = new Task({
      title: title.trim(),
      description,
      user: req.user.id,
    });

    const task = await newTask.save();
    audit(req, 'task.create', { userId: req.user.id, taskId: String(task._id) });
    res.json(task);
  } catch (err) {
    req.log.error({ err }, 'Erreur lors de la création de la tâche');
    res.status(500).send('Server Error');
  }
});

/**
 * **PUT /api/tasks/:id** : modifie une tâche de l'utilisateur connecté.
 *
 * Corps JSON (tous les champs sont facultatifs, seuls ceux envoyés sont modifiés) :
 * `{ "title"?: string, "description"?: string, "isCompleted"?: boolean }`, avec les
 * mêmes règles de validation qu'à la création.
 *
 * Réponses : `200` la tâche modifiée, `400 { msg }` si un champ est invalide, `401` sans
 * token valide, `404 { msg }` si la tâche n'existe pas, si l'identifiant est mal formé ou
 * si la tâche appartient à un autre utilisateur, `500` en cas d'erreur serveur.
 * Journal d'audit : `task.update`, ou `task.access_denied` (warn) pour la tâche d'un autre.
 *
 * @name updateTask
 * @function
 * @memberof module:routes/tasks
 * @param {express.Request} req - `req.params.id` : identifiant de la tâche
 * @param {express.Response} res
 */
router.put('/:id', auth, async (req, res) => {
  const { title, description, isCompleted } = req.body;

  // Bug corrigé (E27) : un identifiant mal formé provoquait une erreur 500 au lieu de 404
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json(TASK_NOT_FOUND);

  // Seuls les champs envoyés sont modifiés, et ils sont validés
  const changes = {};
  if (title !== undefined) {
    const titleError = validateTitle(title);
    if (titleError) return res.status(400).json({ msg: titleError });
    changes.title = title.trim();
  }
  if (description !== undefined) {
    const descriptionError = validateDescription(description);
    if (descriptionError) return res.status(400).json({ msg: descriptionError });
    changes.description = description;
  }
  if (isCompleted !== undefined) {
    if (typeof isCompleted !== 'boolean') return res.status(400).json({ msg: 'Le statut de la tâche est invalide.' });
    changes.isCompleted = isCompleted;
  }

  try {
    const task = await findOwnTask(req, res);
    if (!task) return;

    // Le filtre sur "user" garantit en plus que seule une tâche de l'utilisateur est modifiée
    const updated = await Task.findOneAndUpdate({ _id: task._id, user: req.user.id }, { $set: changes }, { new: true });
    audit(req, 'task.update', { userId: req.user.id, taskId: String(task._id) });
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, 'Erreur lors de la modification de la tâche');
    res.status(500).send('Server Error');
  }
});

/**
 * **DELETE /api/tasks/:id** : supprime une tâche de l'utilisateur connecté.
 *
 * Réponses : `200 { msg: "Tâche supprimée." }`, `401` sans token valide, `404 { msg }` si
 * la tâche n'existe pas, si l'identifiant est mal formé ou si elle appartient à un autre
 * utilisateur, `500` en cas d'erreur serveur.
 * Journal d'audit : `task.delete`, ou `task.access_denied` (warn) pour la tâche d'un autre.
 *
 * @name deleteTask
 * @function
 * @memberof module:routes/tasks
 * @param {express.Request} req - `req.params.id` : identifiant de la tâche
 * @param {express.Response} res
 */
router.delete('/:id', auth, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json(TASK_NOT_FOUND);

  try {
    const task = await findOwnTask(req, res);
    if (!task) return;

    await Task.deleteOne({ _id: task._id, user: req.user.id });
    audit(req, 'task.delete', { userId: req.user.id, taskId: String(task._id) });
    res.json({ msg: 'Tâche supprimée.' });
  } catch (err) {
    req.log.error({ err }, 'Erreur lors de la suppression de la tâche');
    res.status(500).send('Server Error');
  }
});

module.exports = router;
