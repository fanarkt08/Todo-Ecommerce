/**
 * Routes d'authentification, montées sur `/api/auth` (voir app.js).
 * Les deux routes sont protégées contre la force brute (10 échecs maximum par IP
 * en 15 minutes) et écrivent leurs événements dans le journal d'audit.
 * @module routes/auth
 */
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { audit } = require('../config/logger');
const { JWT_ALGORITHM, JWT_EXPIRES_IN, authRateLimiter } = require('../config/security');

/** Lit un champ texte du corps de la requête (chaîne vide s'il est absent ou d'un autre type). */
const readField = (body, name) => (typeof body[name] === 'string' ? body[name] : '');

/**
 * **POST /api/auth/register** : crée un compte et renvoie un token de session.
 *
 * Corps JSON attendu : `{ "username": string, "password": string }`
 * - `username` : 3 à 30 caractères, unique (les espaces au début et à la fin sont retirés) ;
 * - `password` : 6 caractères minimum, stocké uniquement sous forme hachée (bcrypt).
 *
 * Réponses :
 * - `200 { token }` : JWT signé en HS256, valable 1 h, à envoyer ensuite dans l'en-tête `x-auth-token` ;
 * - `400 { msg }` : champ manquant ou invalide, ou nom d'utilisateur déjà utilisé ;
 * - `429 { msg }` : trop d'échecs depuis la même IP (10 en 15 minutes) ;
 * - `500` : erreur serveur (le détail est dans les logs, pas dans la réponse).
 *
 * Journal d'audit : `auth.register` (succès) et `auth.register_failed` (nom déjà pris).
 * Bug corrigé (E27) : les champs vides, les noms trop courts et les mots de passe
 * d'un caractère étaient acceptés.
 *
 * @name register
 * @function
 * @memberof module:routes/auth
 * @param {express.Request} req - requête Express (corps JSON ci-dessus)
 * @param {express.Response} res - réponse Express
 * @example
 * curl -X POST https://todo-ecommerce.duckdns.org/api/auth/register \
 *   -H "Content-Type: application/json" -d '{"username":"alice","password":"secret123"}'
 * // => 200 {"token":"eyJhbGciOiJIUzI1NiIs..."}
 */
router.post('/register', authRateLimiter, async (req, res) => {
  const username = readField(req.body, 'username').trim();
  const password = readField(req.body, 'password');

  if (!username || !password) {
    return res.status(400).json({ msg: 'Veuillez remplir tous les champs.' });
  }
  if (username.length < 3 || username.length > 30) {
    return res.status(400).json({ msg: "Le nom d'utilisateur doit contenir entre 3 et 30 caractères." });
  }
  if (password.length < 6) {
    return res.status(400).json({ msg: 'Le mot de passe doit contenir au moins 6 caractères.' });
  }

  try {
    let user = await User.findOne({ username });
    if (user) {
      audit(req, 'auth.register_failed', { username, reason: 'user_exists' }, 'warn');
      return res.status(400).json({ msg: "Ce nom d'utilisateur est déjà utilisé." });
    }

    user = new User({ username, password });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);

    await user.save();
    audit(req, 'auth.register', { userId: user.id, username });

    const payload = { user: { id: user.id } };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { algorithm: JWT_ALGORITHM, expiresIn: JWT_EXPIRES_IN });
    res.json({ token });
  } catch (err) {
    req.log.error({ err }, "Erreur lors de l'inscription");
    res.status(500).send('Server Error');
  }
});

/**
 * **POST /api/auth/login** : vérifie les identifiants et renvoie un token de session.
 *
 * Corps JSON attendu : `{ "username": string, "password": string }`
 *
 * Réponses :
 * - `200 { token }` : JWT signé en HS256, valable 1 h ;
 * - `400 { msg }` : champ manquant, ou identifiants incorrects. Le message est le même
 *   que le compte existe ou non, pour ne pas révéler quels noms sont inscrits ;
 * - `429 { msg }` : trop d'échecs depuis la même IP (10 en 15 minutes) ;
 * - `500` : erreur serveur.
 *
 * Seules des chaînes de caractères sont acceptées : un objet comme `{"$ne": null}`
 * (injection NoSQL) est traité comme un champ vide.
 * Journal d'audit : `auth.login_success` et `auth.login_failed` (raison : `unknown_user`
 * ou `wrong_password`).
 *
 * @name login
 * @function
 * @memberof module:routes/auth
 * @param {express.Request} req - requête Express (corps JSON ci-dessus)
 * @param {express.Response} res - réponse Express
 */
router.post('/login', authRateLimiter, async (req, res) => {
  const username = readField(req.body, 'username').trim();
  const password = readField(req.body, 'password');

  if (!username || !password) {
    return res.status(400).json({ msg: 'Veuillez remplir tous les champs.' });
  }

  // Message clair pour l'utilisateur, mais volontairement identique que le compte
  // existe ou non : on ne révèle pas quels noms d'utilisateur sont inscrits.
  const invalidCredentials = { msg: "Nom d'utilisateur ou mot de passe incorrect." };

  try {
    let user = await User.findOne({ username });
    if (!user) {
      audit(req, 'auth.login_failed', { username, reason: 'unknown_user' }, 'warn');
      return res.status(400).json(invalidCredentials);
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      audit(req, 'auth.login_failed', { userId: user.id, username, reason: 'wrong_password' }, 'warn');
      return res.status(400).json(invalidCredentials);
    }

    audit(req, 'auth.login_success', { userId: user.id, username });
    const payload = { user: { id: user.id } };
    // Token valable 1 h et signé avec un algorithme imposé (voir config/security.js)
    const token = jwt.sign(payload, process.env.JWT_SECRET, { algorithm: JWT_ALGORITHM, expiresIn: JWT_EXPIRES_IN });
    res.json({ token });
  } catch (err) {
    req.log.error({ err }, 'Erreur lors de la connexion');
    res.status(500).send('Server Error');
  }
});

module.exports = router;
