"use client";

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { CodeEditor, type LintDiagnostic } from '../components/code-editor';
import { EditorPanels, type ErrorItem } from '../components/editor-panels';
import { usePolicies } from '../components/files-list';
import { ServerBadge } from '../components/server-badge';
import { cn } from '@/lib/utils';
import { parseJsonToSchema } from '@/lib/data-context';
import type { RegoDataContext } from 'codemirror-lang-rego';

export default function Home() {
  const { 
    selected, 
    loadPolicy, 
    activePolicyContent, 
    setActivePolicyContent, 
    output, 
    evaluationTimeMs,
    activePanel, 
    setActivePanel, 
    errors,
    lintDiagnostics,
    setLintDiagnostics,
    testResults,
    testSummary
  } = usePolicies();
  const [isPanelVisible, setIsPanelVisible] = useState(true);
  const [isTestEditorVisible, setIsTestEditorVisible] = useState(false);

  // Parse input/data JSON to create data context for autocomplete
  const dataContext: RegoDataContext = useMemo(() => {
    return {
      input: parseJsonToSchema(activePolicyContent.input || '{}', 'Input'),
      data: parseJsonToSchema(activePolicyContent.data || '{}', 'Data')
    };
  }, [activePolicyContent.input, activePolicyContent.data]);

  useEffect(() => {
    if (selected) {
      loadPolicy(selected).then((files) => {
        if (files) {
          setActivePolicyContent(files);
          // Auto-show test editor if there's test content
          if (files.test && files.test.trim().length > 0) {
            setIsTestEditorVisible(true);
          }
        }
      });
    }
  }, [selected, loadPolicy, setActivePolicyContent]);

  // Handle lint diagnostics from the code editor
  const handleLintDiagnostics = useCallback((diagnostics: LintDiagnostic[]) => {
    setLintDiagnostics(diagnostics);
  }, [setLintDiagnostics]);

  // Combine lint diagnostics with runtime errors for the error panel
  const combinedErrors: ErrorItem[] = useMemo(() => {
    // Convert lint diagnostics to ErrorItem format
    const lintErrors: ErrorItem[] = lintDiagnostics.map((d) => ({
      type: 'lint' as const,
      message: `[${d.category || 'lint'}/${d.rule || 'unknown'}] Line ${d.from.line}: ${d.message}`,
    }));

    // Runtime errors are already in ErrorItem format
    return [...lintErrors, ...errors];
  }, [lintDiagnostics, errors]);

  return (
    <div className="flex h-full w-full items-start justify-center font-sans">
      <main className="h-full w-full flex flex-col gap-2">
        <div className="flex h-full w-full flex-1 flex-col gap-2 md:flex-row md:gap-0 min-h-0">
          {/* Left: 60% on md+, responsive on small screens; fills available height */}
          <div className={cn(
            "flex-1 min-h-0 h-full bg-card rounded-lg border border-sidebar-border overflow-hidden p-0 transition-[flex-basis,width] duration-200 ease-linear",
            isPanelVisible ? "md:basis-3/5" : "md:basis-full"
          )}>
            <div className="h-full w-full relative flex flex-col">
              {/* Policy Editor */}
              <div className={cn(
                "relative transition-[flex] duration-200 ease-linear overflow-hidden",
                isTestEditorVisible ? "flex-1" : "flex-1"
              )} style={{ flex: isTestEditorVisible ? '1 1 50%' : '1 1 100%' }}>
                <CodeEditor
                  value={activePolicyContent.policy}
                  onChange={(v) => setActivePolicyContent(prev => ({ ...prev, policy: v }))}
                  language="rego"
                  height="100%"
                  onTogglePanel={() => setIsPanelVisible(!isPanelVisible)}
                  isPanelVisible={isPanelVisible}
                  onLintDiagnostics={handleLintDiagnostics}
                  enableLinting={true}
                  onToggleTestEditor={() => setIsTestEditorVisible(!isTestEditorVisible)}
                  isTestEditorVisible={isTestEditorVisible}
                  showTestToggle={true}
                  dataContext={dataContext}
                />
              </div>

              {/* Test Editor (conditionally visible) */}
              {isTestEditorVisible && (
                <>
                  {/* Divider */}
                  <div className="h-px bg-sidebar-border shrink-0" />
                  
                  {/* Test Editor Panel */}
                  <div className="flex-1 relative overflow-hidden" style={{ flex: '1 1 50%' }}>
                    <CodeEditor
                      value={activePolicyContent.test}
                      onChange={(v) => setActivePolicyContent(prev => ({ ...prev, test: v }))}
                      language="rego"
                      height="100%"
                      enableLinting={false}
                      dataContext={dataContext}
                    />
                    {/* test.rego label - bottom left */}
                    <div className="absolute bottom-2 left-2 z-10 text-xs text-muted-foreground font-medium bg-card/90 px-2 py-1 rounded border border-sidebar-border">
                      test.rego
                    </div>
                  </div>
                </>
              )}

              {/* Floating Rego version tag (bottom-right of left editor block) */}
              <div className="absolute bottom-2 right-2 z-20">
                <ServerBadge />
              </div>
            </div>
          </div>

          {/* Right: 40% on md+, stacks under left on small screens; fills available height */}
          <div className={cn(
            "min-w-0 min-h-0 h-full bg-card rounded-lg border border-sidebar-border overflow-hidden transition-[flex-grow,flex-basis,width,padding,border,opacity,margin] duration-200 ease-linear",
            isPanelVisible 
              ? "flex-1 md:basis-2/5 opacity-100 p-0 md:ml-2" 
              : "flex-none md:basis-0 w-0 opacity-0 p-0 border-0 md:ml-0"
          )}>
            <div className="h-full w-full min-w-0">
              <EditorPanels 
                  inputValue={activePolicyContent.input}
                  dataValue={activePolicyContent.data}
                  outputValue={typeof output === 'string' ? output : JSON.stringify(output ?? {}, null, 2)}
                  onInputChange={(v) => setActivePolicyContent(prev => ({ ...prev, input: v }))}
                  onDataChange={(v) => setActivePolicyContent(prev => ({ ...prev, data: v }))}
                  activePanel={activePanel}
                  onActivePanelChange={setActivePanel}
                  errors={combinedErrors}
                  testResults={testResults}
                  testSummary={testSummary}
                  evaluationTimeMs={evaluationTimeMs}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
