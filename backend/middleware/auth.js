const jwt = require('jsonwebtoken');
const { audit } = require('../config/logger');

module.exports = function (req, res, next) {
  // Get token from header
  const token = req.header('x-auth-token');

  // Check if not token
  if (!token) {
    return res.status(401).json({ msg: 'Accès refusé : vous devez être connecté.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded.user;
    next();
  } catch (err) {
    // Token expiré, falsifié ou signé avec un autre secret
    audit(req, 'auth.invalid_token', { reason: err.name }, 'warn');
    // Bug corrigé (E27) : renvoyait 418 (« I'm a teapot »). 401 permet au frontend
    // de détecter la session expirée et de renvoyer l'utilisateur vers la connexion.
    res.status(401).json({ msg: 'Session expirée ou invalide, veuillez vous reconnecter.' });
  }
};
