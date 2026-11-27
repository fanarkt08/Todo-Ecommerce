/**
 * Point d'entrée du backend (`npm start`) : charge le `.env`, vérifie la robustesse du
 * `JWT_SECRET` (arrêt sinon), se connecte à MongoDB puis démarre l'écoute HTTP (port `PORT`, 5000 par défaut).
 * L'application Express elle-même est définie dans app.js.
 * @module server
 */
require('dotenv').config();
const connectDB = require('./config/db');
const { logger } = require('./config/logger');
const { assertStrongJwtSecret } = require('./config/security');

// Les erreurs qui échappent à Express sont journalisées au lieu d'être perdues.
process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'Promesse rejetée non gérée');
});
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Exception non gérée, arrêt du serveur');
  process.exit(1);
});

// Refuse de démarrer avec un JWT_SECRET faible ou absent (E28)
assertStrongJwtSecret();

// Connexion à la base de données
connectDB();

const app = require('./app');
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => logger.info({ port: Number(PORT) }, `Server running on port ${PORT}`));
