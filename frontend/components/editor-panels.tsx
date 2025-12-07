"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { CodeEditor } from "./code-editor";
import { DataSourcePicker } from "./data-source-picker";
import { InputTemplatePicker } from "./input-template-picker";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "./ui/collapsible";
import { ChevronDown, AlertCircle, AlertTriangle, Info, CheckCircle, XCircle, Clock, Plus } from "lucide-react";
import { Kbd } from "@/components/ui/kbd";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { TestResult, TestSummary } from "./files-list";

export type ErrorType = 'lint' | 'warn' | 'error';

export interface ErrorItem {
  type: ErrorType;
  message: string;
}

interface EditorPanelsProps {
  inputValue?: string;
  dataValue?: string;
  outputValue?: string;
  onInputChange?: (value: string) => void;
  onDataChange?: (value: string) => void;
  onOutputChange?: (value: string) => void;
  activePanel?: string;
  onActivePanelChange?: (panel: string) => void;
  errors?: (string | ErrorItem)[];
  testResults?: TestResult[];
  testSummary?: TestSummary | null;
  evaluationTimeMs?: number | null;
}

interface PanelSectionProps {
  title: string;
  children: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  shortcut?: string;
  right?: React.ReactNode;
}

function PanelSection({ title, children, isOpen, onToggle, shortcut, right }: PanelSectionProps) {
  // Wrapper makes the section a flex item; when open it grows to fill available height
  return (
    <div className={`flex flex-col ${isOpen ? "flex-1" : "flex-none"} overflow-hidden min-w-0`}>
      <Collapsible open={isOpen} onOpenChange={onToggle} className="flex flex-col h-full">
        {/* Header row: clickable trigger on left, non-button actions on right */}
        <div
          data-panel-header
          className="w-full flex items-center gap-2 px-4 py-3 bg-card hover:bg-accent/80 transition-colors shrink-0"
          style={{ fontFamily: "'Funnel Display', ui-serif, Georgia, \"Times New Roman\", serif" }}
        >
          <CollapsibleTrigger className="flex items-center gap-2 flex-1 min-w-0">
            <ChevronDown
              size={16}
              className={`transition-transform ${isOpen ? "" : "-rotate-90"}`}
            />
            <span className="font-medium text-sm flex items-center gap-2">
              {title}
              {shortcut ? <Kbd className="ml-2">{shortcut}</Kbd> : null}
            </span>
          </CollapsibleTrigger>

          {right ? (
            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              {right}
            </div>
          ) : null}
        </div>

        <CollapsibleContent className="bg-card flex-1 flex flex-col overflow-hidden data-[state=closed]:hidden">
          {children}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function ErrorCard({ item }: { item: ErrorItem }) {
  const [expanded, setExpanded] = useState(false);

  const icon = {
    error: <AlertCircle className="text-destructive" size={16} />,
    warn: <AlertTriangle className="text-orange-500" size={16} />,
    lint: <Info className="text-blue-500" size={16} />,
  }[item.type];

  const borderColor = {
    error: "border-destructive/50 hover:border-destructive",
    warn: "border-orange-500/50 hover:border-orange-500",
    lint: "border-blue-500/50 hover:border-blue-500",
  }[item.type];

  const bgColor = {
    error: "bg-destructive/5",
    warn: "bg-orange-500/5",
    lint: "bg-blue-500/5",
  }[item.type];

  return (
    <div
      onClick={() => setExpanded(!expanded)}
      className={cn(
        "flex flex-col gap-2 p-3 rounded-md border cursor-pointer transition-all",
        borderColor,
        bgColor
      )}
    >
      <div className="flex items-start gap-2">
        <div className="mt-0.5 shrink-0">{icon}</div>
        <div className={cn("text-sm font-medium flex-1 break-all", !expanded && "truncate")}>
          {item.message}
        </div>
      </div>
      {expanded && (
        <div className="text-xs text-muted-foreground pl-6 whitespace-pre-wrap font-mono mt-1">
          {item.message}
        </div>
      )}
    </div>
  );
}

function TestResultCard({ result }: { result: TestResult }) {
  const [expanded, setExpanded] = useState(false);

  const status = result.skip ? 'skip' : result.error ? 'error' : result.fail ? 'fail' : 'pass';

  const icon = {
    pass: <CheckCircle className="text-emerald-500" size={16} />,
    fail: <XCircle className="text-destructive" size={16} />,
    error: <AlertCircle className="text-orange-500" size={16} />,
    skip: <Clock className="text-muted-foreground" size={16} />,
  }[status];

  const borderColor = {
    pass: "border-emerald-500/50 hover:border-emerald-500",
    fail: "border-destructive/50 hover:border-destructive",
    error: "border-orange-500/50 hover:border-orange-500",
    skip: "border-muted-foreground/50 hover:border-muted-foreground",
  }[status];

  const bgColor = {
    pass: "bg-emerald-500/5",
    fail: "bg-destructive/5",
    error: "bg-orange-500/5",
    skip: "bg-muted-foreground/5",
  }[status];

  // Format duration (nanoseconds to ms)
  const durationMs = (result.duration / 1_000_000).toFixed(2);

  return (
    <div
      onClick={() => setExpanded(!expanded)}
      className={cn(
        "flex flex-col gap-2 p-3 rounded-md border cursor-pointer transition-all",
        borderColor,
        bgColor
      )}
    >
      <div className="flex items-start gap-2">
        <div className="mt-0.5 shrink-0">{icon}</div>
        <div className={cn("text-sm font-medium flex-1 break-all", !expanded && "truncate")}>
          {result.name}
        </div>
        <div className="text-xs text-muted-foreground shrink-0">
          {durationMs}ms
        </div>
      </div>
      {expanded && (
        <div className="text-xs text-muted-foreground pl-6 space-y-1 mt-1">
          <div><span className="font-medium">Package:</span> {result.package}</div>
          <div><span className="font-medium">Location:</span> {result.location.file}:{result.location.row}</div>
          {result.error && (
            <div className="text-orange-500 font-mono whitespace-pre-wrap">
              <span className="font-medium">Error:</span> {result.error.message}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function EditorPanels({
  inputValue = "{}",
  dataValue = "{}",
  outputValue = "{}",
  onInputChange,
  onDataChange,
  onOutputChange,
  activePanel = "input",
  onActivePanelChange,
  errors = [],
  testResults = [],
  testSummary = null,
  evaluationTimeMs = null,
}: EditorPanelsProps) {
  const [input, setInput] = useState(inputValue);
  const [data, setData] = useState(dataValue);
  const [output, setOutput] = useState(outputValue);
  const [dataSourcePickerOpen, setDataSourcePickerOpen] = useState(false);
  
  const openSections = useMemo(() => ({
    input: activePanel === "input",
    data: activePanel === "data",
    output: activePanel === "output",
    tests: activePanel === "tests",
    errors: activePanel === "errors",
  }), [activePanel]);

  // Calculate truthiness of output
  const outputTruthiness = useMemo((): 'true' | 'false' | 'undefined' | null => {
    // Parse the output to determine truthiness
    let parsed: unknown;
    try {
      parsed = JSON.parse(outputValue || '{}');
    } catch {
      return null; // Can't determine
    }
    
    // Handle the wrapped result format from OPA: { result: ... }
    const value = (parsed && typeof parsed === 'object' && 'result' in parsed) 
      ? (parsed as { result: unknown }).result 
      : parsed;
    
    // Undefined/null/no result
    if (value === undefined || value === null) return 'undefined';
    
    // Explicit boolean
    if (value === true) return 'true';
    if (value === false) return 'false';
    
    // Empty collections → false
    if (Array.isArray(value) && value.length === 0) return 'false';
    if (typeof value === 'object' && Object.keys(value as object).length === 0) return 'false';
    
    // Non-empty collections or any scalar → true
    return 'true';
  }, [outputValue]);

  const processedErrors: ErrorItem[] = useMemo(() => {
    return errors.map(e => {
      if (typeof e === 'string') return { type: 'error', message: e };
      return e;
    });
  }, [errors]);

  const [editorResizeSignal, setEditorResizeSignal] = useState(0);
  const panelsContainerRef = useRef<HTMLDivElement | null>(null);

  const lintCount = processedErrors.filter(e => e.type === 'lint').length;
  const errorCount = processedErrors.filter(e => e.type === 'error').length;
  const warningCount = processedErrors.filter(e => e.type === 'warn').length;

  const passCount = testSummary?.pass ?? 0;
  const failCount = (testSummary?.fail ?? 0) + (testSummary?.error ?? 0);

  // Sync state with props
  useEffect(() => {
    setInput(inputValue);
  }, [inputValue]);

  useEffect(() => {
    setData(dataValue);
  }, [dataValue]);

  useEffect(() => {
    setOutput(outputValue);
  }, [outputValue]);

  // Bump resize signal when activePanel changes to ensure editors render correctly
  useEffect(() => {
    setEditorResizeSignal((s) => s + 1);
  }, [activePanel]);

  // (no external resize signal needed; CodeEditor uses ResizeObserver)

  const handleInputChange = (value: string) => {
    setInput(value);
    onInputChange?.(value);
  };

  const handleDataChange = (value: string) => {
    setData(value);
    onDataChange?.(value);
  };

  // Insert a data source template into the Data editor
  const handleInsertDataSource = useCallback((template: { name: string; template: Record<string, unknown> }) => {
    try {
      // Parse current data (strip comments first for parsing)
      let currentData: Record<string, unknown> = {};
      try {
        // Simple comment stripping for parsing
        const stripped = data.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
        currentData = JSON.parse(stripped || '{}');
      } catch {
        currentData = {};
      }

      // Format with comment markers
      const marker = `// ---- ${template.name} ----`;
      const endMarker = '// ' + '-'.repeat(template.name.length + 10);
      
      // Create formatted output with markers
      const templateKeys = Object.keys(template.template);
      const otherKeys = Object.keys(currentData).filter(k => !templateKeys.includes(k));
      
      let output = '{\n';
      
      // Add existing keys first (without markers)
      otherKeys.forEach((key, idx) => {
        const value = JSON.stringify(currentData[key], null, 2)
          .split('\n')
          .map((line, i) => i === 0 ? line : '  ' + line)
          .join('\n');
        output += `  "${key}": ${value}`;
        if (idx < otherKeys.length - 1 || templateKeys.length > 0) {
          output += ',';
        }
        output += '\n';
      });
      
      // Add separator if we have existing data
      if (otherKeys.length > 0 && templateKeys.length > 0) {
        output += '\n';
      }
      
      // Add template data with markers
      if (templateKeys.length > 0) {
        output += `  ${marker}\n`;
        templateKeys.forEach((key, idx) => {
          const value = JSON.stringify(template.template[key], null, 2)
            .split('\n')
            .map((line, i) => i === 0 ? line : '  ' + line)
            .join('\n');
          output += `  "${key}": ${value}`;
          if (idx < templateKeys.length - 1) {
            output += ',';
          }
          output += '\n';
        });
        output += `  ${endMarker}\n`;
      }
      
      output += '}';

      setData(output);
      onDataChange?.(output);
    } catch (e) {
      console.error('Failed to insert data source:', e);
    }
  }, [data, onDataChange]);

  const handleOutputChange = (value: string) => {
    setOutput(value);
    onOutputChange?.(value);
  };

  const toggleSection = (section: string) => {
    const currentlyOpen = activePanel === section;
    const willOpen = !currentlyOpen;

    if (currentlyOpen) {
      onActivePanelChange?.("");
    } else {
      onActivePanelChange?.(section);
    }

    // If opening, bump the editor resize signal to force recreation of CodeMirror instances
    // — this reliably forces them to size correctly inside the newly-open container.
    if (willOpen) setEditorResizeSignal((s) => s + 1);
  };

  // Keyboard shortcuts: Alt+1..Alt+5 to toggle the panels Input/Data/Output/Tests/Errors
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!e.altKey) return;
      switch (e.key) {
        case "1":
          e.preventDefault();
          onActivePanelChange?.(activePanel === "input" ? "" : "input");
          break;
        case "2":
          e.preventDefault();
          onActivePanelChange?.(activePanel === "data" ? "" : "data");
          break;
        case "3":
          e.preventDefault();
          onActivePanelChange?.(activePanel === "output" ? "" : "output");
          break;
        case "4":
          e.preventDefault();
          onActivePanelChange?.(activePanel === "tests" ? "" : "tests");
          break;
        case "5":
          e.preventDefault();
          onActivePanelChange?.(activePanel === "errors" ? "" : "errors");
          break;
        default:
          break;
      }
    }
    // Use capture phase so the listener runs even if editors (e.g. CodeMirror)
    // call `stopPropagation` or otherwise handle the event during bubbling.
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [activePanel, onActivePanelChange]);

  return (
    <div ref={panelsContainerRef} className="h-full w-full min-w-0 flex flex-col overflow-hidden">
      <PanelSection 
        title="Input"  
        shortcut="Alt+1"
        isOpen={openSections.input}
        onToggle={() => toggleSection("input")}
        right={
          <InputTemplatePicker 
            onSelect={(template) => {
              const formatted = JSON.stringify(template, null, 2);
              setInput(formatted);
              onInputChange?.(formatted);
            }}
            currentValue={input}
          />
        }
      >
        <div className="flex-1 h-full overflow-hidden">
          <CodeEditor
            value={input}
            onChange={handleInputChange}
            language="json"
            height="100%"
            resizeSignal={editorResizeSignal}
          />
        </div>
      </PanelSection>

      <PanelSection 
        title="Data" 
        shortcut="Alt+2"
        isOpen={openSections.data}
        onToggle={() => toggleSection("data")}
        right={
          <button
            onClick={(e) => {
              e.stopPropagation();
              setDataSourcePickerOpen(true);
            }}
            className="inline-flex border rounded-xl items-center gap-1 px-2 py-1 text-xs font-medium text-muted-foreground bg-card hover:text-foreground hover:bg-accent transition-colors"
          >
            <Plus className="  h-3.5 w-3.5" />
            Add Source
          </button>
        }
      >
        <div className="flex-1 h-full overflow-hidden">
          <CodeEditor
            value={data}
            onChange={handleDataChange}
            language="json"
            height="100%"
            resizeSignal={editorResizeSignal}
          />
        </div>
      </PanelSection>

      <DataSourcePicker 
        onInsert={handleInsertDataSource} 
        open={dataSourcePickerOpen}
        onOpenChange={setDataSourcePickerOpen}
      />

      <PanelSection 
        title="Output" 
        shortcut="Alt+3"
        isOpen={openSections.output}
        onToggle={() => toggleSection("output")}
        right={(
          <div className="flex items-center gap-2">
            {outputTruthiness !== null && (
              <Tooltip>
                <TooltipTrigger>
                  <span
                    aria-label={`Result: ${outputTruthiness}`}
                    className={cn(
                      "inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-transparent border text-xs font-medium cursor-default",
                      outputTruthiness === 'true' && "border-emerald-500 text-emerald-700",
                      outputTruthiness === 'false' && "border-destructive text-destructive",
                      outputTruthiness === 'undefined' && "border-muted-foreground text-muted-foreground"
                    )}
                  >
                    {outputTruthiness === 'true' && '✓ True'}
                    {outputTruthiness === 'false' && '✗ False'}
                    {outputTruthiness === 'undefined' && '○ Undefined'}
                  </span>
                </TooltipTrigger>
                <TooltipContent sideOffset={4}>Policy evaluation result</TooltipContent>
              </Tooltip>
            )}
            {evaluationTimeMs !== null && (
              <Tooltip>
                <TooltipTrigger>
                  <span
                    aria-label={`Evaluation time: ${evaluationTimeMs.toFixed(1)}ms`}
                    className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-transparent border border-muted-foreground/50 text-muted-foreground text-xs font-medium cursor-default"
                  >
                    {evaluationTimeMs.toFixed(1)}ms
                  </span>
                </TooltipTrigger>
                <TooltipContent sideOffset={4}>Evaluation time</TooltipContent>
              </Tooltip>
            )}
          </div>
        )}
      >
        <div className="flex-1 h-full overflow-hidden">
          <CodeEditor
            value={output}
            onChange={handleOutputChange}
            language="json"
            height="100%"
            readOnly={true}
            resizeSignal={editorResizeSignal}
          />
        </div>
      </PanelSection>

      <PanelSection 
        title="Tests" 
        shortcut="Alt+4"
        isOpen={openSections.tests}
        onToggle={() => toggleSection("tests")}
        right={(
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger>
                <span
                  aria-label={`Passed tests: ${passCount}`}
                  className="inline-flex items-center justify-center px-3 py-0.5 rounded-full bg-transparent border border-emerald-500 text-emerald-700 text-xs font-medium cursor-default"
                >
                  {passCount}
                </span>
              </TooltipTrigger>
              <TooltipContent sideOffset={4}>Passed tests</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger>
                <span
                  aria-label={`Failed tests: ${failCount}`}
                  className="inline-flex items-center justify-center px-3 py-0.5 rounded-full bg-transparent border border-destructive text-destructive text-xs font-medium cursor-default"
                >
                  {failCount}
                </span>
              </TooltipTrigger>
              <TooltipContent sideOffset={4}>Failed tests</TooltipContent>
            </Tooltip>
          </div>
        )}
      >
        <div className="flex-1 h-full overflow-hidden bg-background/50">
          <div 
            className="w-full h-full overflow-y-auto p-4 space-y-2" 
          >
            {testResults.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-8">
                No test results yet. Click &quot;Test&quot; to run tests.
              </div>
            ) : (
              testResults.map((result, i) => (
                <TestResultCard key={i} result={result} />
              ))
            )}
          </div>
        </div>
      </PanelSection>

      <PanelSection 
        title="Errors" 
        shortcut="Alt+5"
        isOpen={openSections.errors}
        onToggle={() => toggleSection("errors")}
        right={(
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger>
                <span
                  aria-label={`Linting issues: ${lintCount}`}
                  className="inline-flex items-center justify-center px-3 py-0.5 rounded-full bg-transparent border border-yellow-400 text-yellow-700 text-xs font-medium cursor-default"
                >
                  {lintCount}
                </span>
              </TooltipTrigger>
              <TooltipContent sideOffset={4}>Linting issues</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger>
                <span
                  aria-label={`Runtime errors: ${errorCount}`}
                  className="inline-flex items-center justify-center px-3 py-0.5 rounded-full bg-transparent border border-destructive text-destructive text-xs font-medium cursor-default"
                >
                  {errorCount}
                </span>
              </TooltipTrigger>
              <TooltipContent sideOffset={4}>Runtime errors</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger>
                <span
                  aria-label={`Warnings: ${warningCount}`}
                  className="inline-flex items-center justify-center px-3 py-0.5 rounded-full bg-transparent border border-orange-400 text-orange-700 text-xs font-medium cursor-default"
                >
                  {warningCount}
                </span>
              </TooltipTrigger>
              <TooltipContent sideOffset={4}>Warnings and recommendations</TooltipContent>
            </Tooltip>
          </div>
        )}
      >
        <div className="flex-1 h-full overflow-hidden bg-background/50">
          <div 
            className="w-full h-full overflow-y-auto p-4 space-y-2" 
          >
            {processedErrors.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-8">
                No errors found.
              </div>
            ) : (
              processedErrors.map((err, i) => (
                <ErrorCard key={i} item={err} />
              ))
            )}
          </div>
        </div>
      </PanelSection>
    </div>
  );
}
