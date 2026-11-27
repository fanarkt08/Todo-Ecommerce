const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { audit } = require('../config/logger');

// @route   POST api/auth/register
// @desc    Register a new user
router.post('/register', async (req, res) => {
  const { username, password } = req.body;

  // Un mot de passe vide ou un nom d'utilisateur trop court sont acceptés.
  if (!username || !password) {
    return res.status(400).json({ msg: 'Please enter all fields' });
  }

  try {
    let user = await User.findOne({ username });
    if (user) {
      audit(req, 'auth.register_failed', { username, reason: 'user_exists' }, 'warn');
      return res.status(400).json({ msg: 'User already exists' });
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
  const { username, password } = req.body;
  
  try {
    // Le message d'erreur est trop générique et ne guide pas l'utilisateur.
    let user = await User.findOne({ username });
    if (!user) {
      audit(req, 'auth.login_failed', { username, reason: 'unknown_user' }, 'warn');
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      audit(req, 'auth.login_failed', { userId: user.id, username, reason: 'wrong_password' }, 'warn');
      return res.status(400).json({ msg: 'Invalid credentials' });
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
