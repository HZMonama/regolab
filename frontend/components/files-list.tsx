"use client"

import * as React from "react"
import { toast } from "sonner"
import { Popover, PopoverContent } from "@/components/ui/popover"
import { Pencil, Trash, DownloadSimple, FileText } from "phosphor-react"
import { Editable, EditableArea, EditableInput, EditablePreview } from "@/components/ui/editable"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { LintDiagnostic } from "./code-editor"
import type { ErrorItem } from "./editor-panels"

interface PoliciesContextValue {
  policies: string[]
  selected: string | null
  setSelected: (id: string | null) => void
  activePolicyContent: { policy: string; input: string; data: string; test: string }
  setActivePolicyContent: React.Dispatch<React.SetStateAction<{ policy: string; input: string; data: string; test: string }>>
  refresh: () => Promise<void>
  createPolicy: (id?: string, content?: { policy: string; input: string; data: string; test?: string }) => Promise<string | null>
  loadPolicy: (id: string) => Promise<{ policy: string; input: string; data: string; test: string } | null>
  savePolicy: (id: string, files: { policy: string; input: string; data: string; test: string }) => Promise<boolean>
  renamePolicy: (id: string, newId: string) => Promise<boolean>
  deletePolicy: (id: string) => Promise<boolean>
  downloadPolicy: (id: string) => Promise<void>
  handleEvaluate: () => Promise<unknown>
  handleFormat: () => Promise<void>
  handleTest: () => Promise<void>
  output: unknown
  setOutput: (output: unknown) => void
  evaluationTimeMs: number | null
  activePanel: string
  setActivePanel: (panel: string) => void
  errors: ErrorItem[]
  setErrors: (errors: ErrorItem[]) => void
  lintDiagnostics: LintDiagnostic[]
  setLintDiagnostics: (diagnostics: LintDiagnostic[]) => void
  testResults: TestResult[]
  setTestResults: (results: TestResult[]) => void
  testSummary: TestSummary | null
  setTestSummary: (summary: TestSummary | null) => void
}

export interface TestResult {
  location: { file: string; row: number; col: number }
  package: string
  name: string
  fail?: boolean
  error?: { code: string; message: string; location?: { file: string; row: number; col: number } }
  skip?: boolean
  duration: number
}

export interface TestSummary {
  pass: number
  fail: number
  error: number
  skip: number
  total: number
}

export const PoliciesContext = React.createContext<PoliciesContextValue | null>(null)

export function usePolicies() {
  const ctx = React.useContext(PoliciesContext)
  if (!ctx) throw new Error("usePolicies must be used within PoliciesProvider")
  return ctx
}

export function PoliciesProvider({ children }: { children: React.ReactNode }) {
  const [policies, setPolicies] = React.useState<string[]>([])
  const [selected, setSelected] = React.useState<string | null>(null)
  const [activePolicyContent, setActivePolicyContent] = React.useState<{ policy: string; input: string; data: string; test: string }>({
    policy: "// Select a policy to edit",
    input: "{}",
    data: "{}",
    test: ""
  })
  const [output, setOutput] = React.useState<unknown>(null)
  const [activePanel, setActivePanel] = React.useState<string>("input")
  const [errors, setErrors] = React.useState<ErrorItem[]>([])
  const [lintDiagnostics, setLintDiagnostics] = React.useState<LintDiagnostic[]>([])
  const [testResults, setTestResults] = React.useState<TestResult[]>([])
  const [testSummary, setTestSummary] = React.useState<TestSummary | null>(null)
  const [evaluationTimeMs, setEvaluationTimeMs] = React.useState<number | null>(null)

  const fetchList = React.useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch("/policies", { signal })
      if (!res.ok) return
      const data = await res.json()
      const list: string[] = data?.policies ?? []
      setPolicies((prev) => {
        try {
          const prevJson = JSON.stringify(prev)
          const newJson = JSON.stringify(list)
          if (prevJson !== newJson) {
            if (list.length === 0) toast("No policies found")
            else toast.success(`Loaded ${list.length} policies`)
          }
        } catch {
          // ignore JSON stringify errors
        }
        return list
      })
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      console.error("Failed to fetch policies", e)
      toast.error("Failed to fetch policies")
    }
  }, [])

  React.useEffect(() => {
    const controller = new AbortController();
    void fetchList(controller.signal)
    return () => controller.abort();
  }, [fetchList])

  // Auto-select first policy if none selected
  React.useEffect(() => {
    if (policies.length > 0 && !selected) {
      setSelected(policies[0])
    }
  }, [policies, selected, setSelected])

  const refresh = React.useCallback(async () => {
    await fetchList()
  }, [fetchList])

  const createPolicy = React.useCallback(async (id?: string, content?: { policy: string; input: string; data: string; test?: string }) => {
    try {
      let newId = id
      if (!newId) {
        // Find next available policy number
        const numbers = policies
          .map(p => {
            const match = p.match(/^policy-(\d+)$/)
            return match ? parseInt(match[1]) : 0
          })
          .filter(n => !isNaN(n))
        
        const nextNum = numbers.length > 0 ? Math.max(...numbers) + 1 : 1
        newId = `policy-${nextNum}`
      }

      const defaultContent = content || { 
        policy: "package main\n\ndefault allow = false", 
        input: "{}", 
        data: "{}",
        test: ""
      }
      const res = await fetch(`/policies/${encodeURIComponent(newId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(defaultContent),
      })
      if (!res.ok) {
        const txt = await res.text()
        console.error("failed to create policy", txt)
        try {
          const err = JSON.parse(txt)
          toast.error(`Failed to create policy: ${err.details || err.error || txt}`)
        } catch {
          toast.error("Failed to create policy")
        }
        return null
      }
      // refresh and select
      await fetchList()
      setSelected(newId)
      setActivePolicyContent({ ...defaultContent, test: defaultContent.test || "" })
      toast.success(`Created policy ${newId}`)
      return newId
    } catch (e) {
      console.error("createPolicy error", e)
      toast.error("Failed to create policy")
      return null
    }
  }, [fetchList, policies])

  const loadPolicy = React.useCallback(async (id: string) => {
    try {
      const res = await fetch(`/policies/${encodeURIComponent(id)}`)
      if (!res.ok) {
        toast.error("Failed to load policy")
        return null
      }
      const data = await res.json()
      // Ensure test field exists
      return { ...data.files, test: data.files.test || "" }
    } catch (e) {
      console.error("loadPolicy error", e)
      toast.error("Failed to load policy")
      return null
    }
  }, [])

  const savePolicy = React.useCallback(async (id: string, files: { policy: string; input: string; data: string; test: string }) => {
    try {
      const res = await fetch(`/policies/${encodeURIComponent(id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(files),
      })
      if (!res.ok) {
        toast.error("Failed to save policy")
        return false
      }
      toast.success(`Saved policy ${id}`)
      return true
    } catch (e) {
      console.error("savePolicy error", e)
      toast.error("Failed to save policy")
      return false
    }
  }, [])

  const renamePolicy = React.useCallback(async (id: string, newId: string) => {
    try {
      const res = await fetch(`/policies/${encodeURIComponent(id)}/rename`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newId }),
      })
      if (!res.ok) {
        const txt = await res.text()
        try {
          const err = JSON.parse(txt)
          toast.error(`Failed to rename policy: ${err.details || err.error || txt}`)
        } catch {
          toast.error("Failed to rename policy")
        }
        return false
      }
      toast.success(`Renamed policy to ${newId}`)
      await fetchList()
      if (selected === id) setSelected(newId)
      return true
    } catch (e) {
      console.error("renamePolicy error", e)
      toast.error("Failed to rename policy")
      return false
    }
  }, [fetchList, selected])

  const deletePolicy = React.useCallback(async (id: string) => {
    try {
      const res = await fetch(`/policies/${encodeURIComponent(id)}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        toast.error("Failed to delete policy")
        return false
      }
      toast.success(`Deleted policy ${id}`)
      await fetchList()
      if (selected === id) setSelected(null)
      return true
    } catch (e) {
      console.error("deletePolicy error", e)
      toast.error("Failed to delete policy")
      return false
    }
  }, [fetchList, selected])

  const downloadPolicy = React.useCallback(async (id: string) => {
    try {
      window.open(`/policies/${encodeURIComponent(id)}/download`, '_blank')
    } catch (e) {
      console.error("downloadPolicy error", e)
      toast.error("Failed to download policy")
    }
  }, [])

  const handleEvaluate = React.useCallback(async () => {
    if (!selected) return;
    try {
      const res = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          policy: activePolicyContent.policy,
          input: activePolicyContent.input,
          data: activePolicyContent.data,
        }),
      });
      const result = await res.json();
      if (result.success) {
        toast.success("Evaluation successful");
        setOutput(result.result);
        setEvaluationTimeMs(result.evaluationTimeMs ?? null);
        // Clear runtime errors on success, keep lint errors
        setErrors([]);
        setActivePanel("output");
        return result.result;
      } else {
        toast.error(`Evaluation failed: ${result.error || "Unknown error"}`);
        setOutput({ error: result.error });
        setEvaluationTimeMs(null);
        setErrors([{ type: 'error', message: result.error || "Unknown error" }]);
        setActivePanel("errors");
        return { error: result.error };
      }
    } catch (e) {
      console.error("Evaluation error", e);
      toast.error("Evaluation failed: Connection error");
      setOutput({ error: "Failed to connect to server" });
      setEvaluationTimeMs(null);
      setErrors([{ type: 'error', message: "Failed to connect to server" }]);
      setActivePanel("errors");
      return { error: "Failed to connect to server" };
    }
  }, [selected, activePolicyContent]);

  const handleFormat = React.useCallback(async () => {
    // Format Rego
    try {
      const res = await fetch("/api/format", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ policy: activePolicyContent.policy }),
      });
      const result = await res.json();
      if (result.success) {
        setActivePolicyContent(prev => ({ ...prev, policy: result.formatted }));
        toast.success("Formatted files");
      } else {
        toast.error(`Format failed: ${result.error}`);
      }
    } catch (e) {
      console.error("Format error", e);
      toast.error("Format failed");
    }

    // Format JSON (Input)
    try {
      const formattedInput = JSON.stringify(JSON.parse(activePolicyContent.input), null, 2);
      setActivePolicyContent(prev => ({ ...prev, input: formattedInput }));
    } catch (e) {
      // Ignore JSON parse errors, just don't format
    }

    // Format JSON (Data)
    try {
      const formattedData = JSON.stringify(JSON.parse(activePolicyContent.data), null, 2);
      setActivePolicyContent(prev => ({ ...prev, data: formattedData }));
    } catch (e) {
      // Ignore JSON parse errors
    }
  }, [activePolicyContent]);

  const handleTest = React.useCallback(async () => {
    if (!selected) {
      toast.error("No policy selected");
      return;
    }

    if (!activePolicyContent.test || activePolicyContent.test.trim().length === 0) {
      toast.error("No test file content. Add tests using the flask toggle in the policy editor.");
      return;
    }

    try {
      const res = await fetch("/api/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          policy: activePolicyContent.policy,
          testPolicy: activePolicyContent.test,
          data: activePolicyContent.data,
        }),
      });
      const result = await res.json();
      
      if (result.success) {
        setTestResults(result.results || []);
        setTestSummary(result.summary || null);
        setActivePanel("tests");
        
        if (result.summary.fail > 0 || result.summary.error > 0) {
          toast.error(`Tests: ${result.summary.pass} passed, ${result.summary.fail} failed`);
        } else {
          toast.success(`All ${result.summary.pass} tests passed!`);
        }
      } else {
        toast.error(`Test failed: ${result.error || "Unknown error"}`);
        setTestResults([]);
        setTestSummary(null);
        setErrors([{ type: 'error', message: result.error || "Test execution failed" }]);
        setActivePanel("errors");
      }
    } catch (e) {
      console.error("Test error", e);
      toast.error("Test failed: Connection error");
      setTestResults([]);
      setTestSummary(null);
    }
  }, [selected, activePolicyContent]);

  const value = React.useMemo(
    () => ({ 
      policies, 
      selected, 
      setSelected, 
      activePolicyContent,
      setActivePolicyContent,
      refresh, 
      createPolicy, 
      loadPolicy, 
      savePolicy, 
      renamePolicy,
      deletePolicy, 
      downloadPolicy,
      handleEvaluate,
      handleFormat,
      handleTest,
      output,
      setOutput,
      evaluationTimeMs,
      activePanel,
      setActivePanel,
      errors,
      setErrors,
      lintDiagnostics,
      setLintDiagnostics,
      testResults,
      setTestResults,
      testSummary,
      setTestSummary
    }),
    [policies, selected, activePolicyContent, refresh, createPolicy, loadPolicy, savePolicy, renamePolicy, deletePolicy, downloadPolicy, output, evaluationTimeMs, handleEvaluate, handleFormat, handleTest, activePanel, errors, lintDiagnostics, testResults, testSummary]
  )

  return (
    <PoliciesContext.Provider value={value}>{children}</PoliciesContext.Provider>
  )
}

export function FilesList({ className }: { className?: string }) {
  const _ctx = React.useContext(PoliciesContext)
  const ctx = _ctx ?? {
    policies: [] as string[],
    selected: null as string | null,
    setSelected: (() => {}) as unknown as (id: string | null) => void,
    activePolicyContent: { policy: "", input: "{}", data: "{}", test: "" },
    setActivePolicyContent: (() => {}) as unknown as React.Dispatch<React.SetStateAction<{ policy: string; input: string; data: string; test: string }>>,
    refresh: async () => {},
    createPolicy: async () => null,
    loadPolicy: async () => null,
    savePolicy: async () => false,
    renamePolicy: async () => false,
    deletePolicy: async () => false,
    downloadPolicy: async () => {},
    handleEvaluate: async () => {},
    handleFormat: async () => {},
    handleTest: async () => {},
    output: null,
    setOutput: () => {},
    activePanel: "input",
    setActivePanel: () => {},
    errors: [] as ErrorItem[],
    setErrors: () => {},
    lintDiagnostics: [] as LintDiagnostic[],
    setLintDiagnostics: () => {},
    testResults: [] as TestResult[],
    setTestResults: () => {},
    testSummary: null as TestSummary | null,
    setTestSummary: () => {},
  }

  const { policies, selected, setSelected, renamePolicy, deletePolicy, downloadPolicy } = ctx

  const [hovered, setHovered] = React.useState<string | null>(null)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = React.useState<string | null>(null)

  const [contextMenu, setContextMenu] = React.useState<{
    open: boolean
    x: number
    y: number
    file?: string | null
  }>({ open: false, x: 0, y: 0, file: null })

  const [resetKeys, setResetKeys] = React.useState<Record<string, number>>({})

  const closeContext = React.useCallback(() => {
    setContextMenu((s) => ({ ...s, open: false }))
    setPendingDelete(null)
  }, [])

  // Empty state: show a CTA when there are no policies
  if (policies.length === 0) {
    return (
      <div className={className}>
        <div className="flex flex-col items-center justify-center gap-3 p-4 text-sm text-muted-foreground border-t border-dotted border-sidebar-border rounded-md h-full">
          <div className="rounded-full bg-sidebar-accent/20 p-3">
            <FileText className="size-6 text-sidebar-accent-foreground" />
          </div>
          <div className="text-sm font-medium">No policies yet</div>
          <div className="text-xs text-center text-muted-foreground">Add policies using the <br/> &apos; New Policy &apos; button</div>
        </div>
      </div>
    )
  }

  return (
    <div className={className}>
      <h4 className="sr-only">Files</h4>
      <ul className="flex flex-col gap-1 overflow-y-auto flex-1 min-h-0">
        {policies.map((id) => (
          <li key={id}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className={`w-full flex items-center gap-2 rounded-md px-2 py-1 text-sm group cursor-pointer ${selected === id ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : "hover:bg-accent/30"}`}
                  onClick={() => setSelected(id)}
                  onMouseEnter={() => setHovered(id)}
                  onMouseLeave={() => setHovered(null)}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    setContextMenu({ open: true, x: e.clientX, y: e.clientY, file: id })
                  }}
                >
                  <FileText 
                    size={16} 
                    weight={selected === id || hovered === id ? "fill" : "regular"} 
                    className="shrink-0"
                  />
                  <Editable
                    defaultValue={id}
                    key={`${id}-${resetKeys[id] || 0}`}
                    editing={editingId === id}
                    onEditingChange={(e) => {
                      if (!e) setEditingId(null)
                      else setEditingId(id)
                    }}
                    onCancel={() => setEditingId(null)}
                    onSubmit={async (val) => {
                      if (val !== id) {
                        const success = await renamePolicy(id, val)
                        if (!success) {
                          setResetKeys(prev => ({ ...prev, [id]: (prev[id] || 0) + 1 }))
                        }
                      }
                      setEditingId(null)
                    }}
                    triggerMode="dblclick"
                    className="w-full min-w-0"
                  >
                    <EditableArea className="w-full">
                      <EditablePreview className="truncate w-full text-left block font-sans font-light" />
                      <EditableInput className="font-sans font-light h-6 py-0 px-1 w-full" />
                    </EditableArea>
                  </Editable>
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">
                Right Click to Edit
              </TooltipContent>
            </Tooltip>
          </li>
        ))}
      </ul>

      <Popover open={contextMenu.open} onOpenChange={(v) => {
        setContextMenu((s) => ({ ...s, open: v }))
        if (!v) setPendingDelete(null)
      }}>
        <PopoverContent
          sideOffset={4}
          className="w-auto p-2"
          style={{ position: "fixed", left: contextMenu.x, top: contextMenu.y, transform: "translate(-8px, 4px)" }}
        >
          <div className="flex flex-col gap-1">
            <button
              type="button"
              aria-label={contextMenu.file ? `Edit ${contextMenu.file}` : "Edit"}
              className="flex align-start items-center gap-2 w-full text-left text-sm px-2 py-1 rounded hover:bg-accent/50 text-foreground"
              onClick={() => {
                if (contextMenu.file) {
                  setEditingId(contextMenu.file)
                  closeContext()
                }
              }}
            >
              <Pencil size={16} />
              <span>Edit</span>
            </button>
            <button
              type="button"
              aria-label={contextMenu.file ? `Download ${contextMenu.file}` : "Download"}
              className="flex align-start items-center gap-2 w-full text-left text-sm px-2 py-1 rounded hover:bg-accent/50 text-foreground"
              onClick={() => {
                if (contextMenu.file) {
                  downloadPolicy(contextMenu.file)
                  closeContext()
                }
              }}
            >
              <DownloadSimple size={16} />
              <span>Download</span>
            </button>
            <button
              type="button"
              aria-label={contextMenu.file ? `Delete ${contextMenu.file}` : "Delete"}
              className="flex align-start items-center gap-2 w-full text-left text-sm px-2 py-1 rounded hover:bg-destructive/10 text-destructive"
              onClick={() => {
                if (contextMenu.file) {
                  if (pendingDelete === contextMenu.file) {
                    // Second click - actually delete
                    deletePolicy(contextMenu.file)
                    closeContext()
                  } else {
                    // First click - set pending state
                    setPendingDelete(contextMenu.file)
                  }
                }
              }}
            >
              <Trash size={16} />
              <span>{pendingDelete === contextMenu.file ? "Sure?" : "Delete"}</span>
            </button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

export default FilesList
