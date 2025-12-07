import * as storage from '../services/storage.service.js';

export const policyRoutes = async (fastify) => {
  // Create or update policy
  fastify.post(
    '/:id',
    async (request, reply) => {
      const { id } = request.params;
      const { policy, input, data, test } = request.body;

      try {
        await storage.savePolicy(id, { policy, input, data, test });
        
        reply.code(201).send({ 
          success: true, 
          message: 'Policy saved',
          id 
        });
      } catch (error) {
        request.log.error(error);
        reply.code(500).send({ 
          success: false, 
          error: 'Failed to save policy',
          details: error instanceof Error ? error.message : String(error)
        });
      }
    }
  );

  // Get policy by ID
  fastify.get(
    '/:id',
    async (request, reply) => {
      const { id } = request.params;

      try {
        const files = await storage.getPolicy(id);
        reply.send({ 
          success: true, 
          id, 
          files 
        });
      } catch (error) {
        reply.code(404).send({ 
          success: false, 
          error: 'Policy not found' 
        });
      }
    }
  );

  // Delete policy
  fastify.delete(
    '/:id',
    async (request, reply) => {
      const { id } = request.params;

      try {
        await storage.deletePolicy(id);
        reply.send({ 
          success: true, 
          message: 'Policy deleted' 
        });
      } catch (error) {
        reply.code(404).send({ 
          success: false, 
          error: 'Policy not found' 
        });
      }
    }
  );

  // Rename policy
  fastify.post(
    '/:id/rename',
    async (request, reply) => {
      const { id } = request.params;
      const { newId } = request.body;

      if (!newId) {
        reply.code(400).send({
          success: false,
          error: 'New ID is required'
        });
        return;
      }

      try {
        await storage.renamePolicy(id, newId);
        reply.send({ 
          success: true, 
          message: 'Policy renamed',
          id: newId
        });
      } catch (error) {
        request.log.error(error);
        reply.code(500).send({ 
          success: false, 
          error: 'Failed to rename policy',
          details: error instanceof Error ? error.message : String(error)
        });
      }
    }
  );

  // List all policies
  fastify.get('/', async (request, reply) => {
    const policies = await storage.listPolicies();
    reply.send({ 
      success: true, 
      policies 
    });
  });

  // Download policy as zip
  fastify.get(
    '/:id/download',
    async (request, reply) => {
      const { id } = request.params;

      try {
        const zipBuffer = await storage.downloadPolicyAsZip(id);
        
        reply
          .header('Content-Type', 'application/zip')
          .header('Content-Disposition', `attachment; filename="${id}.zip"`)
          .send(zipBuffer);
      } catch (error) {
        reply.code(404).send({ 
          success: false, 
          error: 'Policy not found' 
        });
      }
    }
  );
};