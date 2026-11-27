/**
 * Modèle Mongoose des tâches (collection `tasks`).
 * @module models/Task
 */
const mongoose = require('mongoose');

/**
 * Tâche d'un utilisateur.
 * @typedef {Object} Task
 * @property {string} _id - identifiant MongoDB
 * @property {string} user - identifiant du propriétaire (seul lui peut la lire, la modifier ou la supprimer)
 * @property {string} title - titre obligatoire, 200 caractères maximum, sans HTML
 * @property {string} [description] - texte facultatif, 1 000 caractères maximum, sans HTML
 * @property {boolean} isCompleted - tâche terminée ou non (false à la création)
 * @property {Date} createdAt - date de création (tri de la liste, plus récentes d'abord)
 */
const TaskSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
  },
  isCompleted: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Task', TaskSchema);
