// Outils communs aux tests de l'API (Jest + Supertest).
// Les variables d'environnement sont définies AVANT de charger l'application.
const crypto = require('crypto');

process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'silent';

const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../app');

// Base MongoDB de test : une base dédiée par fichier de test, supprimée à la fin.
const MONGO_BASE = process.env.MONGO_URI_TEST || 'mongodb://127.0.0.1:27017';

/** Connecte Mongoose à une base de test dédiée. */
async function connect(name) {
  await mongoose.connect(`${MONGO_BASE}/todo_test_${name}_${process.pid}`);
}

/** Supprime la base de test et ferme la connexion. */
async function disconnect() {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
}

let counter = 0;
/**
 * Crée un compte de test unique et renvoie son nom et son token.
 * @param {string} [prefix]
 * @returns {Promise<{ username: string, token: string }>}
 */
async function registerUser(prefix = 'user') {
  const username = `${prefix}${Date.now().toString().slice(-6)}${counter++}`;
  const res = await request(app).post('/api/auth/register').send({ username, password: 'secret123' });
  return { username, token: res.body.token };
}

/** En-tête d'authentification d'un utilisateur de test. */
const authHeader = (user) => ({ 'x-auth-token': user.token });

module.exports = { app, request, connect, disconnect, registerUser, authHeader };
