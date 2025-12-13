import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMPLATES_DIR = path.join(__dirname, '../../data/templates');

export const templateRoutes = async (fastify) => {
  // List all templates
  fastify.get('/', async (request, reply) => {
    try {
      const templates = await listTemplates();
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
      const template = await getTemplate(id);
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

async function listTemplates() {
  const templates = [];
  const categories = await fs.readdir(TEMPLATES_DIR);

  for (const category of categories) {
    const categoryPath = path.join(TEMPLATES_DIR, category);
    const stat = await fs.stat(categoryPath);
    
    if (stat.isDirectory()) {
      const templateDirs = await fs.readdir(categoryPath);
      
      for (const templateDir of templateDirs) {
        const templatePath = path.join(categoryPath, templateDir);
        const templateStat = await fs.stat(templatePath);
        
        if (templateStat.isDirectory()) {
          const metaPath = path.join(templatePath, 'meta.json');
          
          try {
            const metaContent = await fs.readFile(metaPath, 'utf-8');
            const meta = JSON.parse(metaContent);
            
            templates.push({
              id: `${category}/${templateDir}`,
              title: meta.title,
              description: meta.description,
              category: meta.category
            });
          } catch (err) {
            // Skip templates without valid meta.json
            continue;
          }
        }
      }
    }
  }

  return templates;
}

async function getTemplate(id) {
  const templatePath = path.join(TEMPLATES_DIR, id);
  
  // Read all template files
  const [meta, policy, input, data, test] = await Promise.all([
    fs.readFile(path.join(templatePath, 'meta.json'), 'utf-8').then(JSON.parse),
    fs.readFile(path.join(templatePath, 'policy.rego'), 'utf-8').catch(() => null),
    fs.readFile(path.join(templatePath, 'input.json'), 'utf-8').then(JSON.parse).catch(() => null),
    fs.readFile(path.join(templatePath, 'data.json'), 'utf-8').then(JSON.parse).catch(() => null),
    fs.readFile(path.join(templatePath, 'test.rego'), 'utf-8').catch(() => null)
  ]);

  return {
    id,
    ...meta,
    policy,
    input,
    data,
    test
  };
}
