const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const auth = require('../middleware/auth');
const Task = require('../models/Task');
const { audit } = require('../config/logger');

const TITLE_MAX_LENGTH = 200;
const TASK_NOT_FOUND = { msg: 'Tâche introuvable.' };

/**
 * Valide le titre d'une tâche.
 * Bug corrigé (E27) : un titre vide provoquait une erreur 500 et un titre composé
 * d'espaces était enregistré (ligne vide dans la liste).
 * @returns {string|null} message d'erreur, ou null si le titre est valide
 */
function validateTitle(title) {
  if (typeof title !== 'string' || !title.trim()) return 'Le titre de la tâche est obligatoire.';
  if (title.trim().length > TITLE_MAX_LENGTH) return `Le titre ne doit pas dépasser ${TITLE_MAX_LENGTH} caractères.`;
  return null;
}

/**
 * Journalise une modification de tâche. Si la tâche appartient à un autre
 * utilisateur, l'événement passe en "warn" : c'est la trace d'un accès à la
 * tâche de quelqu'un d'autre (faille IDOR, voir commentaires ci-dessous).
 */
function auditTaskChange(req, event, task) {
  const ownerId = String(task.user);
  const foreign = ownerId !== req.user.id;
  audit(
    req,
    event,
    { userId: req.user.id, taskId: String(task._id), ownerId, ...(foreign && { reason: 'not_owner' }) },
    foreign ? 'warn' : 'info'
  );
}

// @route   GET api/tasks
// @desc    Get all user tasks
router.get('/', auth, async (req, res) => {
  try {
    const tasks = await Task.find({ user: req.user.id }).sort({ createdAt: -1 });
    res.json(tasks);
  } catch (err) {
    req.log.error({ err }, 'Erreur lors de la lecture des tâches');
    res.status(500).send('Server Error');
  }
});

// @route   POST api/tasks
// @desc    Add a new task
router.post('/', auth, async (req, res) => {
  const { title, description } = req.body;

  const titleError = validateTitle(title);
  if (titleError) return res.status(400).json({ msg: titleError });

  // Un utilisateur pourrait injecter du HTML ou du script dans la description.
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

// @route   PUT api/tasks/:id
// @desc    Update a task
// N'importe quel utilisateur authentifié peut modifier la tâche de n'importe qui d'autre s'il connaît l'ID de la tâche.
// Il manque une vérification pour s'assurer que la tâche appartient bien à l'utilisateur qui fait la requête.
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
  if (description !== undefined) changes.description = description;
  if (isCompleted !== undefined) {
    if (typeof isCompleted !== 'boolean') return res.status(400).json({ msg: 'Le statut de la tâche est invalide.' });
    changes.isCompleted = isCompleted;
  }

  try {
    let task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json(TASK_NOT_FOUND);
    auditTaskChange(req, 'task.update', task);

    task = await Task.findByIdAndUpdate(req.params.id, { $set: changes }, { new: true });

    // Ici c'est corrigé, mais c'est un bug courant à surveiller.
    res.json(task);
  } catch (err) {
    req.log.error({ err }, 'Erreur lors de la modification de la tâche');
    res.status(500).send('Server Error');
  }
});

// @route   DELETE api/tasks/:id
// @desc    Delete a task
// Un utilisateur peut supprimer les tâches des autres.
router.delete('/:id', auth, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json(TASK_NOT_FOUND);

  try {
    let task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json(TASK_NOT_FOUND);
    auditTaskChange(req, 'task.delete', task);

    // findByIdAndRemove est déprécié (supprimé dans Mongoose 8)
    await Task.findByIdAndDelete(req.params.id);

    res.json({ msg: 'Tâche supprimée.' });
  } catch (err) {
    req.log.error({ err }, 'Erreur lors de la suppression de la tâche');
    res.status(500).send('Server Error');
  }
});

module.exports = router;
