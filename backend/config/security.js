/**
 * Réglages de sécurité : robustesse du JWT_SECRET, algorithme JWT, CORS et limitation
 * des tentatives de connexion (E28).
 * @module config/security
 */
const rateLimit = require('express-rate-limit');
const { logger, audit } = require('./logger');

/** Algorithme de signature des tokens, imposé à la signature ET à la vérification. */
const JWT_ALGORITHM = 'HS256';
/** Durée de validité d'un token : une session volée n'est utilisable qu'une heure. */
const JWT_EXPIRES_IN = '1h';
/** HS256 : le secret doit faire au moins 256 bits (32 caractères) pour résister à la force brute. */
const MIN_SECRET_LENGTH = 32;

/**
 * Faille corrigée (E28) : le serveur démarrait avec un JWT_SECRET faible (12 caractères
 * en local) ou vide. Un secret court peut être retrouvé par force brute à partir de
 * n'importe quel token, ce qui permet de forger des tokens pour tous les comptes.
 * Le serveur refuse désormais de démarrer sans secret robuste.
 */
function assertStrongJwtSecret() {
  const length = (process.env.JWT_SECRET || '').length;
  if (length < MIN_SECRET_LENGTH) {
    logger.fatal(
      { length, minimum: MIN_SECRET_LENGTH },
      'JWT_SECRET absent ou trop court : arrêt du serveur. Générer un secret avec : openssl rand -hex 64'
    );
    process.exit(1);
  }
}

/**
 * Faille corrigée (E28) : cors() autorisait n'importe quel site (Access-Control-Allow-Origin: *)
 * à appeler l'API depuis le navigateur d'un utilisateur. Le frontend appelle l'API sur
 * son propre domaine (/api) : aucun site tiers n'a besoin d'y accéder.
 * Origines supplémentaires autorisables via CORS_ORIGINS (liste séparée par des virgules).
 */
function corsOptions() {
  const origins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  return { origin: origins.length ? origins : false };
}

/**
 * Faille corrigée (E28) : aucune limite de tentatives sur la connexion et l'inscription
 * (force brute des mots de passe). Après 10 échecs en 15 minutes depuis la même IP,
 * les requêtes sont refusées (429). Les connexions réussies ne sont pas comptées.
 */
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    audit(req, 'auth.rate_limited', { path: req.originalUrl }, 'warn');
    res.status(options.statusCode).json({ msg: 'Trop de tentatives échouées. Réessayez dans 15 minutes.' });
  },
});

module.exports = { JWT_ALGORITHM, JWT_EXPIRES_IN, assertStrongJwtSecret, corsOptions, authRateLimiter };
