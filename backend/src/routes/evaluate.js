import * as opaService from '../services/opa.service.js';

/**
 * Strip JSONC (JSON with Comments) comments from a string.
 * Handles both // line comments and /* block comments *\/
 */
function stripJsonComments(jsonc) {
  if (!jsonc || typeof jsonc !== 'string') return jsonc;
  
  let result = '';
  let i = 0;
  let inString = false;
  let stringChar = '';
  
  while (i < jsonc.length) {
    const char = jsonc[i];
    const nextChar = jsonc[i + 1];
    
    // Handle string literals (don't strip comments inside strings)
    if ((char === '"' || char === "'") && (i === 0 || jsonc[i - 1] !== '\\')) {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
      }
      result += char;
      i++;
      continue;
    }
    
    if (inString) {
      result += char;
      i++;
      continue;
    }
    
    // Handle // line comments
    if (char === '/' && nextChar === '/') {
      // Skip until end of line
      while (i < jsonc.length && jsonc[i] !== '\n') {
        i++;
      }
      continue;
    }
    
    // Handle /* block comments */
    if (char === '/' && nextChar === '*') {
      i += 2; // Skip /*
      while (i < jsonc.length - 1 && !(jsonc[i] === '*' && jsonc[i + 1] === '/')) {
        i++;
      }
      i += 2; // Skip */
      continue;
    }
    
    result += char;
    i++;
  }
  
  return result;
}

export const evaluateRoutes = async (fastify) => {
  // Evaluate policy
  fastify.post(
    '/evaluate',
    async (request, reply) => {
      const { policy, input, data } = request.body;

      try {
        // Strip JSONC comments from input and data before evaluation
        const cleanInput = stripJsonComments(input);
        const cleanData = stripJsonComments(data);
        
        // Measure evaluation time
        const startTime = process.hrtime.bigint();
        const result = await opaService.evaluatePolicy(policy, cleanInput, cleanData);
        const endTime = process.hrtime.bigint();
        
        // Calculate duration in milliseconds
        const durationNs = Number(endTime - startTime);
        const durationMs = durationNs / 1_000_000;
        
        reply.send({ 
          success: true, 
          result,
          evaluationTimeMs: durationMs
        });
      } catch (error) {
        reply.code(400).send({ 
          success: false, 
          error: error.message || 'Evaluation failed' 
        });
      }
    }
  );

  // Format policy
  fastify.post(
    '/format',
    async (request, reply) => {
      const { policy } = request.body;

      try {
        const formatted = await opaService.formatPolicy(policy);
        reply.send({ 
          success: true, 
          formatted 
        });
      } catch (error) {
        reply.code(400).send({ 
          success: false, 
          error: error.message || 'Format failed' 
        });
      }
    }
  );

  // Test policy
  fastify.post(
    '/test',
    async (request, reply) => {
      const { policy, testPolicy, data } = request.body;

      if (!policy || typeof policy !== 'string') {
        return reply.code(400).send({
          success: false,
          error: 'Policy content is required',
        });
      }

      if (!testPolicy || typeof testPolicy !== 'string') {
        return reply.code(400).send({
          success: false,
          error: 'Test policy content is required',
        });
      }

      try {
        // Strip JSONC comments from data before testing
        const cleanData = stripJsonComments(data || '{}');
        
        const { results, summary } = await opaService.testPolicy(policy, testPolicy, cleanData);
        reply.send({
          success: true,
          results,
          summary,
        });
      } catch (error) {
        reply.code(400).send({
          success: false,
          error: error.message || 'Test execution failed',
        });
      }
    }
  );

  // Check OPA CLI status
  fastify.get(
    '/opa/status',
    async (request, reply) => {
      const status = await opaService.getOpaVersion();
      reply.send({ 
        success: true, 
        ...status
      });
    }
  );
};