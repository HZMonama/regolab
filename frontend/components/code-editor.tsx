"use client";

import React, { useEffect, useRef, useCallback } from "react";
import { EditorState, type Extension, Compartment } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { defaultKeymap, undo, redo, indentWithTab, indentLess } from "@codemirror/commands";
import { linter, type Diagnostic } from "@codemirror/lint";
import { json } from "@codemirror/lang-json";
import { rego, setDataContext, dataContextField } from "@/lib/lang-rego/index";
import { DataContext } from "@/lib/data-context";
import { dataSourceExtension } from "@/lib/cm-data-source";
import { githubDark } from "@fsegurai/codemirror-theme-github-dark";
import { basicSetup } from "codemirror";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { ArrowCounterClockwise, ArrowClockwise, Trash, Copy, Flask } from "phosphor-react";
import { PanelRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useSettings } from "@/lib/settings-context";

// Type for lint diagnostic from the backend
export interface LintDiagnostic {
  from: { line: number; col: number };
  to: { line: number; col: number };
  severity: 'error' | 'warning' | 'info' | 'hint';
  message: string;
  source?: string;
  rule?: string;
  category?: string;
  documentation?: string | null;
}

interface CodeEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  language?: "json" | "rego" | string;
  height?: string;
  readOnly?: boolean;
  className?: string;
  debounceMs?: number;
  // Optional signal the parent can bump to force recreation of the editor
  // instance when the container layout changes in ways ResizeObserver alone
  // doesn't reliably handle.
  resizeSignal?: number;
  onTogglePanel?: () => void;
  isPanelVisible?: boolean;
  // Callback to receive lint diagnostics for external display (e.g., error panel)
  onLintDiagnostics?: (diagnostics: LintDiagnostic[]) => void;
  // Enable or disable linting (only for rego language)
  enableLinting?: boolean;
  // Toggle test editor visibility
  onToggleTestEditor?: () => void;
  isTestEditorVisible?: boolean;
  showTestToggle?: boolean;
  // Data context for autocomplete (input/data schemas)
  dataContext?: DataContext;
}

export function CodeEditor({
  value = "",
  onChange,
  language = "json",
  readOnly = false,
  className = "",
  debounceMs = 0,
  height = "100%",
  resizeSignal,
  onTogglePanel,
  isPanelVisible = true,
  onLintDiagnostics,
  enableLinting = true,
  onToggleTestEditor,
  isTestEditorVisible = false,
  showTestToggle = false,
  dataContext,
}: CodeEditorProps) {
  const { settings } = useSettings();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const changeTimerRef = useRef<number | null>(null);
  const onChangeRef = useRef(onChange);
  const onLintDiagnosticsRef = useRef(onLintDiagnostics);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  
  // Compartments for dynamic reconfiguration
  const fontSizeCompartment = useRef(new Compartment());
  const lineWrapCompartment = useRef(new Compartment());

  // keep refs up to date without causing re-creation of the editor
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onLintDiagnosticsRef.current = onLintDiagnostics;
  }, [onLintDiagnostics]);

  // Create the Rego linter that calls the backend API
  const createRegoLinter = useCallback(() => {
    return linter(async (view): Promise<Diagnostic[]> => {
      const doc = view.state.doc.toString();
      
      // Don't lint empty or very short documents
      if (!doc || doc.trim().length < 10) {
        onLintDiagnosticsRef.current?.([]);
        return [];
      }

      try {
        const response = await fetch('/api/lint', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ policy: doc }),
        });

        if (!response.ok) {
          // Server error - don't show as lint error
          console.error('Lint API error:', response.status);
          return [];
        }

        const result = await response.json();

        if (!result.success || !result.diagnostics) {
          return [];
        }

        // Map backend diagnostics to CodeMirror format
        const cmDiagnostics: Diagnostic[] = result.diagnostics.map((d: LintDiagnostic) => {
          // Convert 1-based line/col to 0-based document offsets
          const fromLine = Math.max(1, d.from.line);
          const toLine = Math.max(1, d.to.line);
          
          // Get line info from the document
          const lineCount = view.state.doc.lines;
          const safeFromLine = Math.min(fromLine, lineCount);
          const safeToLine = Math.min(toLine, lineCount);
          
          const fromLineObj = view.state.doc.line(safeFromLine);
          const toLineObj = view.state.doc.line(safeToLine);
          
          // Calculate positions within the line
          const fromPos = fromLineObj.from + Math.max(0, d.from.col - 1);
          const toPos = toLineObj.from + Math.max(0, d.to.col - 1);
          
          // Ensure valid range
          const from = Math.min(fromPos, view.state.doc.length);
          const to = Math.min(Math.max(toPos, from + 1), view.state.doc.length);

          return {
            from,
            to,
            severity: d.severity === 'error' ? 'error' : 'warning',
            message: d.message,
            source: d.source,
          };
        });

        // Notify parent component of diagnostics for error panel
        onLintDiagnosticsRef.current?.(result.diagnostics);

        return cmDiagnostics;
      } catch (error) {
        console.error('Lint request failed:', error);
        // Don't show connection errors as lint issues
        return [];
      }
    }, {
      delay: 750, // Wait 750ms after typing stops before linting
    });
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    // Clean up any previous view
    if (viewRef.current) {
      viewRef.current.destroy();
      viewRef.current = null;
    }

    // Build extensions depending on the language
    // Put the Tab indent binding before the default keymap so it takes precedence
    const extensions: Extension[] = [
      basicSetup,
      keymap.of([
        indentWithTab,
        { key: "Shift-Tab", run: indentLess },
        ...defaultKeymap
      ]),
      githubDark,
      // Dynamic font size via compartment
      fontSizeCompartment.current.of(EditorView.theme({
        ".cm-content, .cm-gutters": {
          fontSize: `${settings.editor.fontSize}px`,
        },
      })),
      // Dynamic line wrap via compartment
      lineWrapCompartment.current.of(settings.editor.lineWrap ? EditorView.lineWrapping : []),
    ];

    if (language === "json") {
      extensions.push(json());
      extensions.push(dataSourceExtension());
    } else if (language === "rego") {
      extensions.push(rego());
      // Add linting for Rego files if enabled (respects liveLinting setting)
      const shouldLint = enableLinting && !readOnly && settings.linting.liveLinting;
      if (shouldLint) {
        extensions.push(createRegoLinter());
      }
    } else {
      // Fallback: plain text (no extra language extension)
    }

    // Editable flag
    if (readOnly) {
      // set editable to false via EditorView.editable is a view facet, but
      // basicSetup + CM6 default allows editing. We'll rely on readOnly by
      // ignoring edits in the update listener.
    }

    // Create state (start empty; we'll sync `value` in a separate effect)
    const startState = EditorState.create({
      doc: value,
      extensions: [
        ...extensions,
        EditorView.editable.of(!readOnly),
        EditorView.updateListener.of((update) => {
          if (!update.docChanged) return;
          const doc = update.state.doc.toString();
          if (debounceMs > 0) {
            if (changeTimerRef.current) window.clearTimeout(changeTimerRef.current);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            changeTimerRef.current = window.setTimeout(() => onChangeRef.current?.(doc), debounceMs) as any;
          } else {
            onChangeRef.current?.(doc);
          }
        }),
        EditorView.theme({
          "&": { height: "100%" },
          ".cm-scroller": {
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            padding: "0", // keep scroller edge flush; apply padding on content
            boxSizing: "border-box",
          },
          ".cm-content": {
            padding: "16px",
            boxSizing: "border-box",
          },
        }),
      ],
    });

    const view = new EditorView({ state: startState, parent: containerRef.current });
    viewRef.current = view;

    // Set up a ResizeObserver to notify CodeMirror of container size changes.
    // CodeMirror 6 typically reacts to container size, but some layouts require
    // an explicit measurement request. We'll try calling `requestMeasure` if
    // present and read `dom.offsetWidth` as a fallback to force layout.
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(() => {
        const v = viewRef.current;
        if (!v) return;
        try {
          // prefer built-in API if available
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (v as any).requestMeasure?.();
        } catch {
          // ignore
        }
        // read layout to force reflow if needed
        try {
          // accessing offsetWidth forces layout in many browsers
          void v.dom.offsetWidth;
        } catch {}
      });
      ro.observe(containerRef.current);
      resizeObserverRef.current = ro;
    }

    return () => {
      if (changeTimerRef.current) window.clearTimeout(changeTimerRef.current);
      if (viewRef.current) {
        viewRef.current.destroy();
        viewRef.current = null;
      }
      if (resizeObserverRef.current) {
        try {
          resizeObserverRef.current.disconnect();
        } catch {}
        resizeObserverRef.current = null;
      }
    };
  }, [language, readOnly, debounceMs, resizeSignal, enableLinting, createRegoLinter, settings.editor.fontSize, settings.editor.lineWrap, settings.linting.liveLinting]);

  // Sync external value into the editor without recreating it
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (value !== undefined && value !== current) {
      view.dispatch({ changes: { from: 0, to: current.length, insert: value } });
    }
  }, [value]);

  // Dynamically update font size when settings change
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    
    view.dispatch({
      effects: fontSizeCompartment.current.reconfigure(EditorView.theme({
        ".cm-content, .cm-gutters": {
          fontSize: `${settings.editor.fontSize}px`,
        },
      })),
    });
  }, [settings.editor.fontSize]);

  // Dynamically update line wrap when settings change
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    
    view.dispatch({
      effects: lineWrapCompartment.current.reconfigure(
        settings.editor.lineWrap ? EditorView.lineWrapping : []
      ),
    });
  }, [settings.editor.lineWrap]);

  // Update data context for Rego autocomplete
  useEffect(() => {
    const view = viewRef.current;
    if (!view || language !== "rego" || !dataContext) return;
    
    // Only dispatch if the editor has the dataContextField
    if (view.state.field(dataContextField, false) !== undefined) {
      view.dispatch({
        effects: setDataContext.of(dataContext)
      });
    }
  }, [dataContext, language]);

  // Actions for floating controls
  const handleUndo = () => {
    const v = viewRef.current;
    if (!v) return;
    try {
      undo(v);
      v.focus();
    } catch {
      // ignore
    }
  };

  const handleRedo = () => {
    const v = viewRef.current;
    if (!v) return;
    try {
      redo(v);
      v.focus();
    } catch {
      // ignore
    }
  };

  const handleClear = () => {
    const v = viewRef.current;
    if (!v) return;
    v.dispatch({
      changes: { from: 0, to: v.state.doc.length, insert: "" }
    });
    v.focus();
  };

  const handleCopy = () => {
    const v = viewRef.current;
    if (!v) return;
    const text = v.state.doc.toString();
    navigator.clipboard.writeText(text).then(() => {
      toast.success("Copied to clipboard");
    });
    v.focus();
  };

  return (
    <div className={cn("relative w-full", className)} style={{ height, margin: 0, padding: 0 }}>
      <div
        ref={containerRef}
        style={{ height, width: "100%", margin: 0, padding: 0 }}
      />

      {/* Floating button group top-right */}
      <div className="absolute top-2 right-2 z-20">
        <ButtonGroup className="bg-transparent border rounded-md shadow-sm">
          {!readOnly && (
            <>
              <Button size="icon" variant="ghost" onClick={handleUndo} aria-label="Undo">
                <ArrowCounterClockwise />
              </Button>
              <Button size="icon" variant="ghost" onClick={handleRedo} aria-label="Redo">
                <ArrowClockwise />
              </Button>
              <Button size="icon" variant="ghost" onClick={handleClear} aria-label="Clear">
                <Trash />
              </Button>
            </>
          )}
          <Button size="icon" variant="ghost" onClick={handleCopy} aria-label="Copy">
            <Copy />
          </Button>
          {showTestToggle && onToggleTestEditor && (
            <Button 
              size="icon" 
              variant="ghost" 
              onClick={onToggleTestEditor} 
              aria-label={isTestEditorVisible ? "Hide Tests" : "Show Tests"}
              className={cn(isTestEditorVisible && "bg-accent")}
            >
              <Flask className="h-4 w-4" weight={isTestEditorVisible ? "fill" : "regular"} />
            </Button>
          )}
          {onTogglePanel && (
            <Button 
              size="icon" 
              variant="ghost" 
              onClick={onTogglePanel} 
              aria-label={isPanelVisible ? "Hide Panel" : "Show Panel"}
            >
              <PanelRight className={cn("h-4 w-4 transition-transform", !isPanelVisible && "rotate-180")} />
            </Button>
          )}
        </ButtonGroup>
      </div>
    </div>
  );
}
