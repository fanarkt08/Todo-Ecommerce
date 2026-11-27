/**
 * Application Express : middlewares (logs, CORS, JSON), route de santé et routes de l'API.
 * Elle est démarrée par server.js en production et importée directement par les tests (Supertest).
 * @module app
 */
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { httpLogger } = require('./config/logger');
const { corsOptions } = require('./config/security');

const app = express();

// Derrière Caddy et nginx (réseaux Docker privés) : req.ip = IP réelle du client
app.set('trust proxy', 'loopback, linklocal, uniquelocal');
// Ne pas annoncer la technologie du serveur (en-tête X-Powered-By: Express) (E28)
app.disable('x-powered-by');

// Middleware
app.use(httpLogger);
app.use(cors(corsOptions()));
app.use(express.json());

/**
 * GET /api/health : point de contrôle pour la supervision (Prometheus / blackbox).
 *
 * Réponses : `200 { status: "ok", db: "up", uptime }` si l'API répond et que MongoDB
 * est connecté ; `503 { status: "degraded", db: "down" }` sinon. Aucune donnée
 * sensible : uniquement l'état des composants. Exclue des logs HTTP (sondée toutes les 15 s).
 *
 * @name health
 * @function
 * @memberof module:app
 * @param {express.Request} req
 * @param {express.Response} res
 */
app.get('/api/health', (req, res) => {
  const dbUp = mongoose.connection.readyState === 1;
  res.status(dbUp ? 200 : 503).json({
    status: dbUp ? 'ok' : 'degraded',
    db: dbUp ? 'up' : 'down',
    uptime: Math.round(process.uptime()),
  });
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/tasks', require('./routes/tasks'));

// Dernier recours : erreur levée par un middleware ou une route sans try/catch
app.use((err, req, res, next) => {
  req.log.error({ err }, 'Erreur non gérée dans une route');
  res.status(500).send('Something broke!');
});

module.exports = app;
