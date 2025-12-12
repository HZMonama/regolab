#!/usr/bin/env node

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read PORT from environment or default to 8080
const PORT = process.env.PORT || '8080';
const HOST = process.env.HOST || '0.0.0.0';

console.log(`Starting Fastify server on ${HOST}:${PORT}`);

// Import and start fastify
import Fastify from 'fastify';
import appPlugin from './app.js';

const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info'
  }
});

// Register the application plugin
await fastify.register(appPlugin);

// Start server
try {
  await fastify.listen({
    port: parseInt(PORT, 10),
    host: HOST
  });
  console.log(`Server successfully started on ${HOST}:${PORT}`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}

// Graceful shutdown
const signals = ['SIGINT', 'SIGTERM'];
signals.forEach((signal) => {
  process.on(signal, async () => {
    console.log(`Received ${signal}, closing server gracefully...`);
    await fastify.close();
    process.exit(0);
  });
});
