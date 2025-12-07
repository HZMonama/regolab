import * as regalService from '../services/regal.service.js';

export const lintRoutes = async (fastify) => {
  // Lint policy
  fastify.post(
    '/lint',
    async (request, reply) => {
      const { policy } = request.body;

      if (!policy || typeof policy !== 'string') {
        return reply.code(400).send({
          success: false,
          error: 'Policy content is required',
        });
      }

      try {
        const result = await regalService.lintPolicy(policy);
        const diagnostics = regalService.mapToDiagnostics(result.violations);

        reply.send({
          success: true,
          diagnostics,
          summary: result.summary,
          violationCount: result.violations.length,
        });
      } catch (error) {
        console.error('Lint error:', error);
        reply.code(500).send({
          success: false,
          error: error.message || 'Linting failed',
        });
      }
    }
  );

  // Check Regal status
  fastify.get(
    '/regal/status',
    async (request, reply) => {
      const status = await regalService.checkRegalAvailable();
      reply.send({
        success: true,
        ...status,
      });
    }
  );
};
