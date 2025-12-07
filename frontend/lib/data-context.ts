/**
 * Data Context System for RegoLab
 * 
 * Parses JSON from Input/Data panels and provides:
 * - Autocomplete suggestions for input.* and data.* paths
 * - Hover tooltips showing type and example values
 */

export interface SchemaNode {
  type: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';
  children?: Record<string, SchemaNode>;
  arrayItemType?: SchemaNode;
  example?: unknown;
  source?: string; // e.g., "OIDC Token", "K8s AdmissionReview"
}

export interface DataContext {
  input: SchemaNode | null;
  data: SchemaNode | null;
}

/**
 * Parse a JSON string and extract schema information
 */
export function parseJsonToSchema(jsonString: string, sourceName?: string): SchemaNode | null {
  try {
    // Strip JSONC comments before parsing
    const stripped = jsonString
      .replace(/\/\/[^\n]*/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '');
    
    const parsed = JSON.parse(stripped);
    return buildSchemaNode(parsed, sourceName);
  } catch {
    return null;
  }
}

/**
 * Recursively build a schema node from a value
 */
function buildSchemaNode(value: unknown, sourceName?: string): SchemaNode {
  if (value === null) {
    return { type: 'null', example: null, source: sourceName };
  }
  
  if (Array.isArray(value)) {
    const node: SchemaNode = { 
      type: 'array', 
      example: value.length > 0 ? value.slice(0, 3) : [],
      source: sourceName
    };
    
    // If array has items, infer the item type from first element
    if (value.length > 0) {
      node.arrayItemType = buildSchemaNode(value[0], sourceName);
    }
    
    return node;
  }
  
  if (typeof value === 'object') {
    const children: Record<string, SchemaNode> = {};
    
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      children[key] = buildSchemaNode(val, sourceName);
    }
    
    return { 
      type: 'object', 
      children, 
      example: Object.keys(value as object).slice(0, 5),
      source: sourceName
    };
  }
  
  if (typeof value === 'string') {
    return { type: 'string', example: value, source: sourceName };
  }
  
  if (typeof value === 'number') {
    return { type: 'number', example: value, source: sourceName };
  }
  
  if (typeof value === 'boolean') {
    return { type: 'boolean', example: value, source: sourceName };
  }
  
  return { type: 'null', source: sourceName };
}

/**
 * Get completions for a given path prefix (e.g., "input.identity" -> ["sub", "email", "roles"])
 */
export function getCompletionsForPath(
  context: DataContext,
  prefix: string
): Array<{ label: string; type: string; detail?: string; info?: string }> {
  const completions: Array<{ label: string; type: string; detail?: string; info?: string }> = [];
  
  // Parse the prefix to determine which schema to use
  const parts = prefix.split('.');
  const root = parts[0]; // "input" or "data"
  const pathParts = parts.slice(1);
  
  let schema: SchemaNode | null = null;
  
  if (root === 'input') {
    schema = context.input;
  } else if (root === 'data') {
    schema = context.data;
  }
  
  if (!schema) {
    return completions;
  }
  
  // Navigate to the current position in the schema
  let current: SchemaNode | null = schema;
  
  for (const part of pathParts) {
    if (!part) continue; // Skip empty parts
    
    if (current?.type === 'object' && current.children) {
      current = current.children[part] || null;
    } else if (current?.type === 'array' && current.arrayItemType) {
      // For array access like input.roles[0], we'd need index handling
      // For now, support accessing array item properties
      const index = parseInt(part, 10);
      if (!isNaN(index)) {
        current = current.arrayItemType;
      } else if (current.arrayItemType.type === 'object' && current.arrayItemType.children) {
        current = current.arrayItemType.children[part] || null;
      } else {
        current = null;
      }
    } else {
      current = null;
    }
    
    if (!current) break;
  }
  
  // If we found a valid position, return its children as completions
  if (current?.type === 'object' && current.children) {
    for (const [key, node] of Object.entries(current.children)) {
      completions.push({
        label: key,
        type: getCompletionType(node.type),
        detail: node.type,
        info: formatExampleValue(node)
      });
    }
  } else if (current?.type === 'array' && current.arrayItemType?.type === 'object' && current.arrayItemType.children) {
    // Suggest array item properties with [_] suffix notation
    for (const [key, node] of Object.entries(current.arrayItemType.children)) {
      completions.push({
        label: `[_].${key}`,
        type: getCompletionType(node.type),
        detail: `array item → ${node.type}`,
        info: formatExampleValue(node)
      });
    }
  }
  
  return completions;
}

/**
 * Get tooltip info for a complete path (e.g., "input.identity.roles")
 */
export function getTooltipForPath(
  context: DataContext,
  path: string
): { type: string; example?: string; source?: string } | null {
  const parts = path.split('.');
  const root = parts[0];
  const pathParts = parts.slice(1);
  
  let schema: SchemaNode | null = null;
  
  if (root === 'input') {
    schema = context.input;
  } else if (root === 'data') {
    schema = context.data;
  }
  
  if (!schema) return null;
  
  let current: SchemaNode | null = schema;
  
  for (const part of pathParts) {
    if (!part) continue;
    
    // Handle array index notation like [0] or [_]
    const indexMatch = part.match(/^\[(\d+|_)\]$/);
    if (indexMatch && current?.type === 'array' && current.arrayItemType) {
      current = current.arrayItemType;
      continue;
    }
    
    if (current?.type === 'object' && current.children) {
      current = current.children[part] || null;
    } else if (current?.type === 'array' && current.arrayItemType?.type === 'object' && current.arrayItemType.children) {
      current = current.arrayItemType.children[part] || null;
    } else {
      current = null;
    }
    
    if (!current) break;
  }
  
  if (!current) return null;
  
  return {
    type: formatTypeDescription(current),
    example: formatExampleValue(current),
    source: current.source
  };
}

/**
 * Map schema type to CodeMirror completion type
 */
function getCompletionType(schemaType: string): string {
  switch (schemaType) {
    case 'object': return 'property';
    case 'array': return 'variable';
    case 'string': return 'text';
    case 'number': return 'constant';
    case 'boolean': return 'constant';
    default: return 'variable';
  }
}

/**
 * Format the type description for display
 */
function formatTypeDescription(node: SchemaNode): string {
  if (node.type === 'array') {
    if (node.arrayItemType) {
      return `array<${node.arrayItemType.type}>`;
    }
    return 'array';
  }
  return node.type;
}

/**
 * Format example value for display
 */
function formatExampleValue(node: SchemaNode): string {
  if (node.example === undefined || node.example === null) {
    return '';
  }
  
  if (node.type === 'object') {
    const keys = node.example as string[];
    return `{ ${keys.join(', ')}${keys.length >= 5 ? ', ...' : ''} }`;
  }
  
  if (node.type === 'array') {
    const arr = node.example as unknown[];
    const preview = JSON.stringify(arr.slice(0, 3));
    return arr.length > 3 ? preview.replace(/\]$/, ', ...]') : preview;
  }
  
  if (node.type === 'string') {
    const str = node.example as string;
    return str.length > 30 ? `"${str.slice(0, 30)}..."` : `"${str}"`;
  }
  
  return String(node.example);
}

/**
 * Extract data source names from JSONC comments
 */
export function extractDataSourceNames(jsonString: string): string[] {
  const names: string[] = [];
  const regex = /\/\/ ---- (.+) ----/g;
  let match;
  
  while ((match = regex.exec(jsonString)) !== null) {
    names.push(match[1]);
  }
  
  return names;
}
