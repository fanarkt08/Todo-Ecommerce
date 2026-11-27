const mongoose = require('mongoose');
const { logger } = require('./logger');

const dbLogger = logger.child({ component: 'mongodb' });

// Coupures et reconnexions à la base : indispensables pour diagnostiquer une panne.
mongoose.connection.on('disconnected', () => dbLogger.warn('MongoDB déconnecté'));
mongoose.connection.on('reconnected', () => dbLogger.info('MongoDB reconnecté'));
mongoose.connection.on('error', (err) => dbLogger.error({ err }, 'Erreur MongoDB'));

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    dbLogger.info('MongoDB Connected...');
  } catch (err) {
    // Le message d'erreur ne contient pas le mot de passe de l'URI
    dbLogger.fatal({ err: { message: err.message, name: err.name } }, 'Connexion à MongoDB impossible');
    process.exit(1);
  }
};

module.exports = connectDB;
