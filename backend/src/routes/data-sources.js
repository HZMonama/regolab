import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_SOURCES_DIR = path.join(__dirname, '../../data/data-sources');

export async function dataSourceRoutes(fastify, options) {
  // List all data sources
  fastify.get('/data-sources', async (request, reply) => {
    try {
      const files = await fs.readdir(DATA_SOURCES_DIR);
      const dataSources = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const content = await fs.readFile(path.join(DATA_SOURCES_DIR, file), 'utf-8');
          const parsed = JSON.parse(content);
          dataSources.push({
            id: parsed.id,
            name: parsed.name,
            description: parsed.description,
            category: parsed.category
          });
        }
      }

      // Sort by category, then by name
      dataSources.sort((a, b) => {
        if (a.category !== b.category) {
          return a.category.localeCompare(b.category);
        }
        return a.name.localeCompare(b.name);
      });

      return { dataSources };
    } catch (error) {
      fastify.log.error('Failed to list data sources:', error);
      return reply.status(500).send({ error: 'Failed to list data sources' });
    }
  });

  // Get a specific data source template
  fastify.get('/data-sources/:id', async (request, reply) => {
    try {
      const { id } = request.params;
      const filePath = path.join(DATA_SOURCES_DIR, `${id}.json`);

      try {
        await fs.access(filePath);
      } catch {
        return reply.status(404).send({ error: 'Data source not found' });
      }

      const content = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(content);

      return parsed;
    } catch (error) {
      fastify.log.error('Failed to get data source:', error);
      return reply.status(500).send({ error: 'Failed to get data source' });
    }
  });
}
