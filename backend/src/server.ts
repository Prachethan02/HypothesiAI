import { createApp } from './app';
import { config } from './config';
import { logger } from './utils/logger';
import { pgPool } from './db/postgres';
import { closeNeo4j, initNeo4j } from './db/neo4j';

const app = createApp();

initNeo4j()
  .then(() => {
    const server = app.listen(config.PORT, () => {
      logger.info(`🚀 HypothesiAI Backend running on port ${config.PORT} [${config.NODE_ENV}]`);
      logger.info(`📡 Healthcheck route configured at: ${config.API_PREFIX}/health (port ${config.PORT})`);
    });

    // Graceful shutdown handling
    let isShuttingDown = false;

    async function shutdown(signal: string) {
      if (isShuttingDown) return;
      isShuttingDown = true;
      logger.info(`Received ${signal}. Starting graceful shutdown...`);

      server.close(async () => {
        logger.info('HTTP server closed. Draining connections...');

        try {
          await pgPool.end();
          logger.info('PostgreSQL connection pool closed.');
        } catch (err) {
          logger.error('Error closing PostgreSQL pool', err);
        }

        try {
          await closeNeo4j();
          logger.info('Neo4j driver connection closed.');
        } catch (err) {
          logger.error('Error closing Neo4j driver', err);
        }

        process.exit(0);
      });

      // Force close after 10s timeout
      setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 10000).unref();
    }

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    process.on('unhandledRejection', (reason: any) => {
      logger.error('Unhandled Promise Rejection:', reason);
    });

    process.on('uncaughtException', (err: Error) => {
      logger.error('Uncaught Exception thrown:', err);
      shutdown('uncaughtException');
    });
  })
  .catch((err) => {
    logger.error('Failed to initialize application', err);
    process.exit(1);
  });
