import * as storage from '../services/storage.service.js';

export const templateRoutes = async (fastify) => {
  // List all templates
  fastify.get('/', async (request, reply) => {
    try {
      const templates = await storage.listTemplates();
      reply.send({ 
        success: true, 
        templates 
      });
    } catch (error) {
      request.log.error(error);
      reply.code(500).send({ 
        success: false, 
        error: 'Failed to list templates' 
      });
    }
  });

  // Get template by ID
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params;

    try {
      const template = await storage.getTemplate(id);
      reply.send({ 
        success: true, 
        template 
      });
    } catch (error) {
      reply.code(404).send({ 
        success: false, 
        error: 'Template not found' 
      });
    }
  });
};
