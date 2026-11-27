const crypto = require('crypto');
const pino = require('pino');
const pinoHttp = require('pino-http');

/**
 * Logger applicatif (Pino).
 *
 * - Une ligne JSON par événement sur la sortie standard : Docker la collecte
 *   (`docker compose logs backend`) et la fait tourner (rotation configurée
 *   dans docker-compose.yml). Le format JSON peut être envoyé tel quel vers un
 *   outil centralisé (Loki, Elasticsearch...).
 * - Niveau réglable par la variable LOG_LEVEL (debug, info, warn, error).
 * - Les secrets (token JWT, mots de passe) sont masqués avant écriture.
 */
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: {
    service: 'backend',
    env: process.env.APP_ENV || process.env.NODE_ENV || 'development',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => ({ level: label }),
  },
  redact: {
    paths: [
      'req.headers["x-auth-token"]',
      'req.headers.authorization',
      'req.headers.cookie',
      'password',
      '*.password',
    ],
    censor: '[MASQUÉ]',
  },
});

/**
 * Middleware de journalisation des requêtes HTTP.
 * Pour chaque requête : méthode, URL, code de réponse, durée, IP du client et
 * un identifiant unique (renvoyé dans l'en-tête X-Request-Id) qui permet de
 * retrouver toutes les lignes de log d'une même requête.
 */
const httpLogger = pinoHttp({
  logger,
  // Les logs écrits pendant la requête (audit, erreurs) portent seulement "reqId"
  quietReqLogger: true,
  // Les sondes de supervision (toutes les 15 s) ne polluent pas les logs
  autoLogging: { ignore: (req) => req.url === '/api/health' },
  genReqId: (req, res) => {
    const id = req.headers['x-request-id'] || crypto.randomUUID();
    res.setHeader('X-Request-Id', id);
    return id;
  },
  customLogLevel: (req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  serializers: {
    req: (req) => ({
      id: req.id,
      method: req.method,
      url: req.url,
      ip: req.raw.ip,
      userAgent: req.headers['user-agent'],
    }),
    res: (res) => ({ statusCode: res.statusCode }),
  },
});

/**
 * Journal d'audit : trace les actions sensibles (inscription, connexion,
 * création / modification / suppression de tâches) avec qui, quoi, quand et
 * depuis quelle IP. Chaque ligne porte "audit": true, ce qui permet de les
 * isoler facilement : docker compose logs backend | grep '"audit":true'
 *
 * @param {import('express').Request} req - requête en cours (fournit l'IP et l'identifiant de requête)
 * @param {string} event - nom de l'événement, ex. "auth.login_failed"
 * @param {object} [details] - informations utiles (jamais de mot de passe ni de token)
 * @param {'info'|'warn'} [level='info'] - "warn" pour les échecs et tentatives suspectes
 */
function audit(req, event, details = {}, level = 'info') {
  (req.log || logger)[level]({ audit: true, event, ip: req.ip, ...details }, `audit: ${event}`);
}

module.exports = { logger, httpLogger, audit };
