const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Task = require('../models/Task');
const { audit } = require('../config/logger');

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

  // Un utilisateur pourrait injecter du HTML ou du script dans la description.
  try {
    const newTask = new Task({
      title,
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
  
  try {
    let task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ msg: 'Task not found' });
    auditTaskChange(req, 'task.update', task);

    task = await Task.findByIdAndUpdate(req.params.id, { $set: { title, description, isCompleted } }, { new: true });

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
  try {
    let task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ msg: 'Task not found' });
    auditTaskChange(req, 'task.delete', task);

    await Task.findByIdAndRemove(req.params.id);

    res.json({ msg: 'Task removed' });
  } catch (err) {
    req.log.error({ err }, 'Erreur lors de la suppression de la tâche');
    res.status(500).send('Server Error');
  }
});

module.exports = router;
