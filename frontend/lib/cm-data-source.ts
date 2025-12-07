/**
 * CodeMirror 6 extension for data source markers in JSONC.
 * Provides gutter decorations and custom folding for marked sections.
 */

import { EditorView, gutter, GutterMarker, ViewPlugin, ViewUpdate, Decoration, DecorationSet } from "@codemirror/view";
import { StateField, RangeSet } from "@codemirror/state";
import { foldService } from "@codemirror/language";

// Regex to match data source markers
const START_MARKER = /^(\s*)\/\/ ---- (.+) ----\s*$/;
const END_MARKER = /^(\s*)\/\/ -{10,}\s*$/;

interface DataSourceBlock {
  from: number;
  to: number;
  name: string;
  startLine: number;
  endLine: number;
}

/**
 * Find all data source blocks in the document
 */
function findDataSourceBlocks(doc: { lines: number; line: (n: number) => { text: string; from: number; to: number } }): DataSourceBlock[] {
  const blocks: DataSourceBlock[] = [];
  let currentBlock: { from: number; name: string; startLine: number } | null = null;

  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i);
    const startMatch = line.text.match(START_MARKER);
    const endMatch = line.text.match(END_MARKER);

    if (startMatch && !currentBlock) {
      currentBlock = {
        from: line.from,
        name: startMatch[2],
        startLine: i
      };
    } else if (endMatch && currentBlock) {
      blocks.push({
        from: currentBlock.from,
        to: line.to,
        name: currentBlock.name,
        startLine: currentBlock.startLine,
        endLine: i
      });
      currentBlock = null;
    }
  }

  return blocks;
}

/**
 * Gutter marker for data source blocks
 */
class DataSourceGutterMarker extends GutterMarker {
  constructor(readonly name: string, readonly isStart: boolean) {
    super();
  }

  toDOM() {
    const marker = document.createElement("div");
    marker.className = "cm-data-source-gutter-marker";
    marker.style.cssText = `
      width: 4px;
      height: 100%;
      background: hsl(210, 100%, 50%);
      border-radius: 2px;
      opacity: 0.7;
    `;
    marker.title = this.name;
    return marker;
  }
}

/**
 * Create the gutter extension for data source markers
 */
export function dataSourceGutter() {
  const gutterMarkerState = StateField.define<RangeSet<GutterMarker>>({
    create(state) {
      return computeGutterMarkers(state.doc);
    },
    update(value, tr) {
      if (tr.docChanged) {
        return computeGutterMarkers(tr.state.doc);
      }
      return value;
    }
  });

  function computeGutterMarkers(doc: { lines: number; line: (n: number) => { text: string; from: number; to: number } }): RangeSet<GutterMarker> {
    const markers: { from: number; marker: GutterMarker }[] = [];
    const blocks = findDataSourceBlocks(doc);

    for (const block of blocks) {
      // Only add marker on the first line (start line) of each block
      const line = doc.line(block.startLine);
      markers.push({
        from: line.from,
        marker: new DataSourceGutterMarker(block.name, true)
      });
    }

    return RangeSet.of(markers.map(m => m.marker.range(m.from)), true);
  }

  return [
    gutterMarkerState,
    gutter({
      class: "cm-data-source-gutter",
      markers: (view) => view.state.field(gutterMarkerState)
    })
  ];
}

/**
 * Line decoration for data source comment lines
 */
const dataSourceLineDecoration = Decoration.line({
  class: "cm-data-source-line"
});

const dataSourceStartDecoration = Decoration.line({
  class: "cm-data-source-start"
});

const dataSourceEndDecoration = Decoration.line({
  class: "cm-data-source-end"
});

/**
 * Create line decorations for data source markers
 */
export function dataSourceDecorations() {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = this.computeDecorations(view);
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = this.computeDecorations(update.view);
        }
      }

      computeDecorations(view: EditorView): DecorationSet {
        const decorations: { from: number; decoration: Decoration }[] = [];
        const blocks = findDataSourceBlocks(view.state.doc);

        for (const block of blocks) {
          // Start line
          decorations.push({
            from: view.state.doc.line(block.startLine).from,
            decoration: dataSourceStartDecoration
          });

          // Content lines
          for (let lineNum = block.startLine + 1; lineNum < block.endLine; lineNum++) {
            decorations.push({
              from: view.state.doc.line(lineNum).from,
              decoration: dataSourceLineDecoration
            });
          }

          // End line
          decorations.push({
            from: view.state.doc.line(block.endLine).from,
            decoration: dataSourceEndDecoration
          });
        }

        return Decoration.set(
          decorations.map(d => d.decoration.range(d.from)),
          true
        );
      }
    },
    {
      decorations: (v) => v.decorations
    }
  );
}

/**
 * Fold service for data source blocks
 */
export function dataSourceFolding() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return foldService.of((state, lineStart, _lineEnd) => {
    const line = state.doc.lineAt(lineStart);
    const startMatch = line.text.match(START_MARKER);
    
    if (!startMatch) return null;

    // Find the end marker
    for (let i = line.number + 1; i <= state.doc.lines; i++) {
      const checkLine = state.doc.line(i);
      if (checkLine.text.match(END_MARKER)) {
        // Fold from end of start line to start of end line
        return { from: line.to, to: checkLine.from - 1 };
      }
      // If we hit another start marker, stop
      if (checkLine.text.match(START_MARKER)) {
        break;
      }
    }

    return null;
  });
}

/**
 * Theme for data source markers
 */
export function dataSourceTheme() {
  return EditorView.theme({
    ".cm-data-source-gutter": {
      width: "6px",
      marginRight: "4px"
    },
    ".cm-data-source-start": {
      backgroundColor: "rgba(59, 130, 246, 0.1)",
      borderTop: "1px solid rgba(59, 130, 246, 0.3)"
    },
    ".cm-data-source-line": {
      backgroundColor: "rgba(59, 130, 246, 0.05)"
    },
    ".cm-data-source-end": {
      backgroundColor: "rgba(59, 130, 246, 0.1)",
      borderBottom: "1px solid rgba(59, 130, 246, 0.3)"
    }
  });
}

/**
 * Combined extension for all data source features
 */
export function dataSourceExtension() {
  return [
    dataSourceGutter(),
    dataSourceDecorations(),
    dataSourceFolding(),
    dataSourceTheme()
  ];
}
