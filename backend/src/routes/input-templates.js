import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Go up from src/routes to backend/data/input-templates
const INPUT_TEMPLATES_DIR = path.join(__dirname, '..', '..', 'data', 'input-templates');

/**
 * @param {import('fastify').FastifyInstance} fastify
 */
export default async function inputTemplatesRoutes(fastify) {
  // List all input templates
  fastify.get('/api/input-templates', async (request, reply) => {
    try {
      const files = await fs.readdir(INPUT_TEMPLATES_DIR);
      const jsonFiles = files.filter(f => f.endsWith('.json'));
      
      const templates = await Promise.all(
        jsonFiles.map(async (file) => {
          const content = await fs.readFile(path.join(INPUT_TEMPLATES_DIR, file), 'utf-8');
          const data = JSON.parse(content);
          return {
            id: data.id,
            name: data.name,
            description: data.description,
            category: data.category
          };
        })
      );

      return { success: true, templates };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ 
        success: false, 
        error: 'Failed to load input templates' 
      });
    }
  });

  // Get a specific input template
  fastify.get('/api/input-templates/:id', async (request, reply) => {
    const { id } = request.params;
    
    try {
      const filePath = path.join(INPUT_TEMPLATES_DIR, `${id}.json`);
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);
      
      return {
        success: true,
        id: data.id,
        name: data.name,
        description: data.description,
        category: data.category,
        template: data.template
      };
    } catch (error) {
      if (error.code === 'ENOENT') {
        return reply.status(404).send({ 
          success: false, 
          error: 'Input template not found' 
        });
      }
      fastify.log.error(error);
      return reply.status(500).send({ 
        success: false, 
        error: 'Failed to load input template' 
      });
    }
  });
}
