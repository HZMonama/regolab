import fs, { constants } from 'fs/promises';
import path from 'path';
import archiver from 'archiver';
import { Readable } from 'stream';

const STORAGE_DIR = process.env.STORAGE_PATH || path.join(process.cwd(), 'data', 'policies');
const TEMPLATES_DIR = path.join(process.cwd(), 'data', 'templates');

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

export async function savePolicy(
  id,
  files
) {
  console.log(`[Storage] Saving policy '${id}'`);
  console.log(`[Storage] STORAGE_DIR: '${STORAGE_DIR}'`);
  
  try {
    await fs.access(STORAGE_DIR, constants.W_OK);
    console.log(`[Storage] STORAGE_DIR is writable`);
  } catch (err) {
    console.error(`[Storage] STORAGE_DIR is NOT writable:`, err);
  }

  const policyDir = path.join(STORAGE_DIR, id);
  console.log(`[Storage] Target directory: '${policyDir}'`);

  try {
    await ensureDir(policyDir);
  } catch (err) {
    console.error(`[Storage] Failed to create directory '${policyDir}':`, err);
    throw err;
  }

  try {
    const writes = [
      fs.writeFile(path.join(policyDir, 'policy.rego'), files.policy),
      fs.writeFile(path.join(policyDir, 'input.json'), files.input),
      fs.writeFile(path.join(policyDir, 'data.json'), files.data),
    ];
    // Save test file if provided
    if (files.test !== undefined) {
      writes.push(fs.writeFile(path.join(policyDir, 'test.rego'), files.test));
    }
    await Promise.all(writes);
    console.log(`[Storage] Policy '${id}' saved successfully`);
  } catch (err) {
    console.error(`[Storage] Failed to write files for '${id}':`, err);
    throw err;
  }
}

export async function getPolicy(id) {
  const policyDir = path.join(STORAGE_DIR, id);

  const [policy, input, data] = await Promise.all([
    fs.readFile(path.join(policyDir, 'policy.rego'), 'utf-8'),
    fs.readFile(path.join(policyDir, 'input.json'), 'utf-8'),
    fs.readFile(path.join(policyDir, 'data.json'), 'utf-8'),
  ]);

  // Try to read test file (optional)
  let test = '';
  try {
    test = await fs.readFile(path.join(policyDir, 'test.rego'), 'utf-8');
  } catch (e) {
    // Test file doesn't exist, that's fine
  }

  return { policy, input, data, test };
}

export async function deletePolicy(id) {
  const policyDir = path.join(STORAGE_DIR, id);
  await fs.rm(policyDir, { recursive: true, force: true });
}

export async function renamePolicy(oldId, newId) {
  const oldPath = path.join(STORAGE_DIR, oldId);
  const newPath = path.join(STORAGE_DIR, newId);
  
  // Check if new name already exists
  try {
    await fs.access(newPath);
    throw new Error('Policy with this name already exists');
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }

  await fs.rename(oldPath, newPath);
}

export async function listPolicies() {
  console.log(`[Storage] Listing policies from '${STORAGE_DIR}'`);
  try {
    await ensureDir(STORAGE_DIR);
    const entries = await fs.readdir(STORAGE_DIR, { withFileTypes: true });
    const policies = entries.filter(e => e.isDirectory()).map(e => e.name);
    console.log(`[Storage] Found policies: ${policies.join(', ')}`);
    return policies;
  } catch (err) {
    console.error(`[Storage] Failed to list policies from '${STORAGE_DIR}':`, err);
    throw err;
  }
}

export async function downloadPolicyAsZip(id) {
  const policyDir = path.join(STORAGE_DIR, id);
  
  return new Promise(async (resolve, reject) => {
    const archive = archiver('zip', { zlib: { level: 9 } });
    const chunks = [];

    archive.on('data', (chunk) => chunks.push(chunk));
    archive.on('end', () => resolve(Buffer.concat(chunks)));
    archive.on('error', reject);

    // Add files to archive
    archive.file(path.join(policyDir, 'policy.rego'), { name: 'policy.rego' });
    archive.file(path.join(policyDir, 'input.json'), { name: 'input.json' });
    archive.file(path.join(policyDir, 'data.json'), { name: 'data.json' });
    
    // Add test file if it exists
    try {
      await fs.access(path.join(policyDir, 'test.rego'));
      archive.file(path.join(policyDir, 'test.rego'), { name: 'test.rego' });
    } catch (e) {
      // Test file doesn't exist, skip it
    }

    await archive.finalize();
  });
}

export async function listTemplates() {
  await ensureDir(TEMPLATES_DIR);
  const categoryEntries = await fs.readdir(TEMPLATES_DIR, { withFileTypes: true });
  const categoryDirs = categoryEntries.filter(e => e.isDirectory()).map(e => e.name);

  const templates = [];
  
  for (const category of categoryDirs) {
    const categoryPath = path.join(TEMPLATES_DIR, category);
    const templateEntries = await fs.readdir(categoryPath, { withFileTypes: true });
    const templateDirs = templateEntries.filter(e => e.isDirectory()).map(e => e.name);
    
    for (const templateName of templateDirs) {
      try {
        const templateDir = path.join(categoryPath, templateName);
        const [policy, input, data, metaStr] = await Promise.all([
          fs.readFile(path.join(templateDir, 'policy.rego'), 'utf-8'),
          fs.readFile(path.join(templateDir, 'input.json'), 'utf-8'),
          fs.readFile(path.join(templateDir, 'data.json'), 'utf-8'),
          fs.readFile(path.join(templateDir, 'meta.json'), 'utf-8'),
        ]);
        
        // Try to read test file (optional)
        let test = '';
        try {
          test = await fs.readFile(path.join(templateDir, 'test.rego'), 'utf-8');
        } catch (e) {
          // Test file doesn't exist, that's fine
        }
        
        const meta = JSON.parse(metaStr);
        templates.push({ 
          id: templateName,
          category,
          meta,
          files: { policy, input, data, test }
        }); 
      } catch (e) {
        console.warn(`Skipping template ${category}/${templateName}: invalid or missing files`, e);
      }
    }
  }
  return templates;
}

export async function getTemplate(id) {
  // Search for template in all category folders
  await ensureDir(TEMPLATES_DIR);
  const categoryEntries = await fs.readdir(TEMPLATES_DIR, { withFileTypes: true });
  const categoryDirs = categoryEntries.filter(e => e.isDirectory()).map(e => e.name);
  
  for (const category of categoryDirs) {
    const templateDir = path.join(TEMPLATES_DIR, category, id);
    try {
      const [policy, input, data, metaStr] = await Promise.all([
        fs.readFile(path.join(templateDir, 'policy.rego'), 'utf-8'),
        fs.readFile(path.join(templateDir, 'input.json'), 'utf-8'),
        fs.readFile(path.join(templateDir, 'data.json'), 'utf-8'),
        fs.readFile(path.join(templateDir, 'meta.json'), 'utf-8'),
      ]);

      // Try to read test file (optional)
      let test = '';
      try {
        test = await fs.readFile(path.join(templateDir, 'test.rego'), 'utf-8');
      } catch (e) {
        // Test file doesn't exist, that's fine
      }

      return { 
        policy, 
        input, 
        data,
        test,
        meta: JSON.parse(metaStr)
      };
    } catch (e) {
      // Template not found in this category, continue searching
    }
  }
  
  throw new Error(`Template not found: ${id}`);
}