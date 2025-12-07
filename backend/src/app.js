import cors from '@fastify/cors';
import { policyRoutes } from './routes/policies.js';
import { evaluateRoutes } from './routes/evaluate.js';
import { templateRoutes } from './routes/templates.js';
import { lintRoutes } from './routes/lint.js';
import { dataSourceRoutes } from './routes/data-sources.js';
import { versionRoutes } from './routes/version.js';
import inputTemplatesRoutes from './routes/input-templates.js';

export default async function (fastify, opts) {
  console.log('Fastify plugin loaded');
  // Register CORS
  fastify.register(cors, {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000'
  });

  // Health check
  fastify.get('/health', async () => {
    return { status: 'ok' };
  });

  // Register routes
  fastify.register(policyRoutes, { prefix: '/api/policies' });
  fastify.register(evaluateRoutes, { prefix: '/api' });
  fastify.register(templateRoutes, { prefix: '/api/templates' });
  fastify.register(lintRoutes, { prefix: '/api' });
  fastify.register(dataSourceRoutes, { prefix: '/api' });
  fastify.register(versionRoutes, { prefix: '/api' });
  fastify.register(inputTemplatesRoutes);
}