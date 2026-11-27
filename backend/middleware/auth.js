const jwt = require('jsonwebtoken');
const { audit } = require('../config/logger');
const { JWT_ALGORITHM } = require('../config/security');

/**
 * Middleware Express qui protège une route : exige un token JWT valide dans l'en-tête
 * `x-auth-token` et place l'utilisateur connecté dans `req.user` (`{ id }`).
 *
 * - Pas de token : `401 { msg: "Accès refusé : vous devez être connecté." }` ;
 * - token expiré, falsifié, non signé ou signé avec un autre secret :
 *   `401 { msg: "Session expirée ou invalide..." }` et événement `auth.invalid_token`
 *   dans le journal d'audit.
 *
 * @module middleware/auth
 * @param {express.Request} req
 * @param {express.Response} res
 * @param {express.NextFunction} next - appelé seulement si le token est valide
 * @example
 * router.get('/', auth, (req, res) => res.json({ userId: req.user.id }));
 */
module.exports = function auth(req, res, next) {
  const token = req.header('x-auth-token');

  if (!token) {
    return res.status(401).json({ msg: 'Accès refusé : vous devez être connecté.' });
  }

  try {
    // Algorithme imposé : refuse les tokens non signés ("none") ou signés autrement (E28)
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: [JWT_ALGORITHM] });
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
