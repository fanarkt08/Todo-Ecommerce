/**
 * Modèle Mongoose des utilisateurs (collection `users`).
 * @module models/User
 */
const mongoose = require('mongoose');

/**
 * Utilisateur enregistré.
 * @typedef {Object} User
 * @property {string} _id - identifiant MongoDB
 * @property {string} username - nom unique (3 à 30 caractères, validé par la route d'inscription)
 * @property {string} password - mot de passe haché avec bcrypt, jamais stocké ni renvoyé en clair
 */
const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
});

module.exports = mongoose.model('User', UserSchema);
