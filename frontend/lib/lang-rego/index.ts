import { parser } from "./syntax.grammar.ts";
import { LRLanguage, LanguageSupport, indentNodeProp, foldNodeProp, foldInside, delimitedIndent, syntaxTree } from "@codemirror/language";
import { styleTags } from "@lezer/highlight";
import { completeFromList, CompletionContext, Completion } from "@codemirror/autocomplete";
import { StateField, StateEffect, Facet } from "@codemirror/state";
import { hoverTooltip, Tooltip } from "@codemirror/view";
import { regoHighlighting } from "./highlight.js";
import capabilities from "./capabilities.json";
import { DataContext, getCompletionsForPath, getTooltipForPath } from "../data-context";

// Type definitions for capabilities
interface BuiltInFunction {
  name: string;
  description?: string;
  decl?: {
    args?: Array<{ type: string }>;
    result?: { type: string };
  };
}

interface Capabilities {
  builtins?: BuiltInFunction[];
}

// Cast capabilities to the correct type
const typedCapabilities = capabilities as Capabilities;

// 1. Prepare Completion Data
const builtInCompletions: Completion[] = (typedCapabilities.builtins || []).map((b: BuiltInFunction) => ({
  label: b.name,
  type: "function",
  detail: "built-in",
  info: b.description || "Rego built-in function"
}));

const keywordCompletions: Completion[] = [
  { label: "package", type: "keyword", info: "Package declaration" },
  { label: "import", type: "keyword", info: "Import statement" },
  { label: "default", type: "keyword", info: "Default rule value" },
  { label: "some", type: "keyword", info: "Existential quantifier" },
  { label: "every", type: "keyword", info: "Universal quantifier" },
  { label: "if", type: "keyword", info: "Conditional clause" },
  { label: "else", type: "keyword", info: "Else clause" },
  { label: "contains", type: "keyword", info: "Partial set rule" },
  { label: "with", type: "keyword", info: "Mock/replace value" },
  { label: "in", type: "keyword", info: "Set membership" },
  { label: "not", type: "keyword", info: "Negation" },
  { label: "as", type: "keyword", info: "Alias" },
  { label: "true", type: "constant", info: "Boolean true" },
  { label: "false", type: "constant", info: "Boolean false" },
  { label: "null", type: "constant", info: "Null value" },
  { label: "set", type: "function", info: "Empty set constructor" }
];

const allCompletions: Completion[] = [...builtInCompletions, ...keywordCompletions];

// State effect to update data context
export const setDataContext = StateEffect.define<DataContext>();

// Facet to provide data context to the editor
export const dataContextFacet = Facet.define<DataContext, DataContext>({
  combine: values => values[values.length - 1] || { input: null, data: null }
});

// State field to store the current data context
export const dataContextField = StateField.define<DataContext>({
  create() {
    return { input: null, data: null };
  },
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setDataContext)) {
        return effect.value;
      }
    }
    return value;
  }
});

// 2. Define Custom Completion Logic
function regoCompletionSource(context: CompletionContext) {
  // Get the node at the current cursor position
  const nodeBefore = syntaxTree(context.state).resolveInner(context.pos, -1);

  // If we are inside a String or Comment, do NOT provide autocomplete
  if (nodeBefore.name === "String" || 
      nodeBefore.name === "RawString" || 
      nodeBefore.name === "LineComment") {
    return null;
  }
  
  // Check if we're typing a path like input.* or data.*
  const line = context.state.doc.lineAt(context.pos);
  const textBefore = line.text.slice(0, context.pos - line.from);
  
  // Match input. or data. paths (including nested like input.identity.roles.)
  const pathMatch = textBefore.match(/(input|data)(\.[a-zA-Z_][a-zA-Z0-9_]*)*\.?$/);
  
  if (pathMatch) {
    const dataContext = context.state.field(dataContextField, false);
    
    if (dataContext) {
      const fullPath = pathMatch[0].replace(/\.$/, ''); // Remove trailing dot for lookup
      const completions = getCompletionsForPath(dataContext, fullPath);
      
      if (completions.length > 0) {
        // Find where the current property name starts
        const lastDotIndex = pathMatch[0].lastIndexOf('.');
        const from = context.pos - (pathMatch[0].length - lastDotIndex - 1);
        
        return {
          from: pathMatch[0].endsWith('.') ? context.pos : from,
          options: completions.map(c => ({
            label: c.label,
            type: c.type,
            detail: c.detail,
            info: c.info
          }))
        };
      }
    }
  }
  
  // Check for "input" or "data" as standalone to suggest the root paths
  const rootMatch = textBefore.match(/\b(inp|inpu|input|dat|data)$/);
  if (rootMatch) {
    const dataContext = context.state.field(dataContextField, false);
    const rootCompletions: Completion[] = [];
    
    if (dataContext?.input) {
      rootCompletions.push({
        label: 'input',
        type: 'variable',
        detail: 'Input document',
        info: 'The input document for policy evaluation'
      });
    }
    if (dataContext?.data) {
      rootCompletions.push({
        label: 'data',
        type: 'variable', 
        detail: 'Data document',
        info: 'The data document for policy evaluation'
      });
    }
    
    if (rootCompletions.length > 0) {
      return {
        from: context.pos - rootMatch[0].length,
        options: rootCompletions
      };
    }
  }
  
  // Check if we're in a specific context where we want filtered completions
  let contextualCompletions = allCompletions;
  
  // If we're right after "package" or "import", suggest only identifiers (filter out keywords)
  if (nodeBefore.name === "package" || nodeBefore.name === "import") {
    return null; // Let user type package/module names freely
  }
  
  // If we're in a rule body or expression context, show functions + keywords
  if (nodeBefore.name === "Body" || 
      nodeBefore.name === "Statement" || 
      nodeBefore.name === "Expression") {
    contextualCompletions = allCompletions;
  }
  
  // Return completions using the standard completeFromList
  return completeFromList(contextualCompletions)(context);
}

// 3. Define Language with proper node types from your grammar
export const RegoLanguage = LRLanguage.define({
  parser: parser.configure({
    props: [
      // Indentation rules for block structures
      indentNodeProp.add({
        Body: delimitedIndent({ closing: "}" }),
        Object: delimitedIndent({ closing: "}" }),
        Array: delimitedIndent({ closing: "]" }),
        Set: delimitedIndent({ closing: "}" }),
        ArrayComprehension: delimitedIndent({ closing: "]" }),
        SetComprehension: delimitedIndent({ closing: "}" }),
        ObjectComprehension: delimitedIndent({ closing: "}" })
      }),
      // Folding rules for collapsible regions
      foldNodeProp.add({
        Body: foldInside,
        Object: foldInside,
        Array: foldInside,
        Set: foldInside,
        ArrayComprehension: foldInside,
        SetComprehension: foldInside,
        ObjectComprehension: foldInside
      }),
      // Apply syntax highlighting from highlight.js
      styleTags(regoHighlighting)
    ]
  }),
  languageData: {
    commentTokens: { line: "#" },
    closeBrackets: { brackets: ["(", "[", "{", '"', '`'] },
    indentOnInput: /^\s*[}\])]$/
  }
});

// 4. Hover tooltip for input/data paths
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function regoHoverTooltip(view: import("@codemirror/view").EditorView, pos: number, _side: 1 | -1): Tooltip | null {
  const dataContext = view.state.field(dataContextField, false);
  if (!dataContext) return null;
  
  // Find the word/path at the hover position
  const line = view.state.doc.lineAt(pos);
  const lineText = line.text;
  const linePos = pos - line.from;
  
  // Find the path containing the hover position
  // Match input.* or data.* paths
  const pathRegex = /(input|data)(\.[a-zA-Z_][a-zA-Z0-9_]*)*/g;
  let match;
  
  while ((match = pathRegex.exec(lineText)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    
    if (linePos >= start && linePos <= end) {
      // Calculate exact path up to hover position
      const fullPath = match[0];
      const tooltip = getTooltipForPath(dataContext, fullPath);
      
      if (tooltip) {
        return {
          pos: line.from + start,
          end: line.from + end,
          above: true,
          create() {
            const dom = document.createElement("div");
            dom.className = "cm-data-tooltip";
            dom.style.cssText = `
              padding: 8px 12px;
              font-family: ui-monospace, monospace;
              font-size: 12px;
              max-width: 400px;
            `;
            
            // Type line
            const typeLine = document.createElement("div");
            typeLine.style.cssText = "color: #93c5fd; font-weight: 500;";
            typeLine.textContent = tooltip.type;
            dom.appendChild(typeLine);
            
            // Source line (if available)
            if (tooltip.source) {
              const sourceLine = document.createElement("div");
              sourceLine.style.cssText = "color: #9ca3af; font-size: 11px; margin-top: 4px;";
              sourceLine.textContent = `from ${tooltip.source}`;
              dom.appendChild(sourceLine);
            }
            
            // Example line (if available)
            if (tooltip.example) {
              const exampleLine = document.createElement("div");
              exampleLine.style.cssText = "color: #a5b4fc; margin-top: 6px; font-style: italic;";
              exampleLine.textContent = `Example: ${tooltip.example}`;
              dom.appendChild(exampleLine);
            }
            
            return { dom };
          }
        };
      }
    }
  }
  
  return null;
}

// 5. Export Language Support
export function rego() {
  return new LanguageSupport(RegoLanguage, [
    dataContextField,
    RegoLanguage.data.of({
      autocomplete: regoCompletionSource 
    }),
    hoverTooltip(regoHoverTooltip, { hideOnChange: true })
  ]);
}

// Export for use in other modules
export { regoCompletionSource, allCompletions };