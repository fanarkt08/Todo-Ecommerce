const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { audit } = require('../config/logger');

/** Lit un champ texte du corps de la requête (chaîne vide s'il est absent ou d'un autre type). */
const readField = (body, name) => (typeof body[name] === 'string' ? body[name] : '');

// @route   POST api/auth/register
// @desc    Register a new user
// Bug corrigé (E27) : les champs vides, les noms d'utilisateur trop courts et les
// mots de passe d'un caractère étaient acceptés.
router.post('/register', async (req, res) => {
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
    jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: 3600 }, (err, token) => {
      if (err) throw err;
      res.json({ token });
    });
  } catch (err) {
    req.log.error({ err }, "Erreur lors de l'inscription");
    res.status(500).send('Server Error');
  }
});

// @route   POST api/auth/login
// @desc    Authenticate user & get token
router.post('/login', async (req, res) => {
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
    // La durée de vie du token est peut-être trop longue pour certaines applications.
    jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: 3600 }, (err, token) => {
      if (err) throw err;
      res.json({ token });
    });
  } catch (err) {
    req.log.error({ err }, 'Erreur lors de la connexion');
    res.status(500).send('Server Error');
  }
});

module.exports = router;
