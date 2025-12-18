import cors from '@fastify/cors';
import { evaluateRoutes } from './routes/evaluate.js';
import { templateRoutes } from './routes/templates.js';
import { lintRoutes } from './routes/lint.js';
import { dataSourceRoutes } from './routes/data-sources.js';
import { versionRoutes } from './routes/version.js';
import inputTemplatesRoutes from './routes/input-templates.js';
import { githubRoutes } from './routes/github.js';

export default async function (fastify, opts) {
  console.log('Fastify plugin loaded');
  
  // Register CORS - allow multiple origins for Cloud Run deployment
  const allowedOrigins = process.env.CORS_ORIGIN 
    ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
    : ['http://localhost:3000', 'https://regolab.maynframe.xyz'];
  
  fastify.register(cors, {
    origin: (origin, cb) => {
      // Allow requests with no origin (like mobile apps, curl, etc.)
      if (!origin) {
        cb(null, true);
        return;
      }
      
      if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        cb(null, true);
      } else {
        cb(new Error('Not allowed by CORS'), false);
      }
    },
    credentials: true
  });

  // Health check
  fastify.get('/health', async () => {
    return { status: 'ok' };
  });

  // Register routes - OPA compute routes only (no file storage)
  fastify.register(evaluateRoutes, { prefix: '/api' });
  fastify.register(lintRoutes, { prefix: '/api' });
  fastify.register(templateRoutes, { prefix: '/api/templates' });
  fastify.register(dataSourceRoutes, { prefix: '/api' });
  fastify.register(versionRoutes, { prefix: '/api' });
  fastify.register(inputTemplatesRoutes);
  fastify.register(githubRoutes, { prefix: '/api/github' });
}