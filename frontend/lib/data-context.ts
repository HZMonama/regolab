/**
 * Data Context Utilities for RegoLab
 * 
 * Parses JSON from input.json and data.json into SchemaNode trees
 * compatible with codemirror-lang-rego's data context system.
 * 
 * The codemirror-lang-rego package handles autocomplete and tooltips internally.
 * This module only provides the parseJsonToSchema function to build schema trees.
 */

import type { SchemaNode } from 'codemirror-lang-rego';

// Re-export the type for convenience
export type { SchemaNode };

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
