// Point d'entrée du serveur backend
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const { logger, httpLogger } = require('./config/logger');

// Les erreurs qui échappent à Express sont journalisées au lieu d'être perdues.
process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'Promesse rejetée non gérée');
});
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Exception non gérée, arrêt du serveur');
  process.exit(1);
});

// Connexion à la base de données
connectDB();

const app = express();

// Derrière Caddy et nginx (réseaux Docker privés) : req.ip = IP réelle du client
app.set('trust proxy', 'loopback, linklocal, uniquelocal');

// Middleware
app.use(httpLogger);
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/tasks', require('./routes/tasks'));

// Ce handler ne catch que les erreurs synchrones. Les erreurs dans les promesses ne sont pas gérées.
app.use((err, req, res, next) => {
  req.log.error({ err }, 'Erreur non gérée dans une route');
  res.status(500).send('Something broke!');
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => logger.info({ port: Number(PORT) }, `Server running on port ${PORT}`));
