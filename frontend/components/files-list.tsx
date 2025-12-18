"use client"

import * as React from "react"
import { toast } from "sonner"
import { Popover, PopoverContent } from "@/components/ui/popover"
import { Pencil, Trash, DownloadSimple, FileText, LinkSimple } from "phosphor-react"
import { Editable, EditableArea, EditableInput, EditablePreview } from "@/components/ui/editable"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import type { LintDiagnostic } from "./code-editor"
import type { ErrorItem } from "./editor-panels"
import { useAuth } from "@/lib/auth-context"
import { 
  subscribeToPolicies, 
  savePolicy as firestoreSavePolicy, 
  deletePolicy as firestoreDeletePolicy,
  renamePolicy as firestoreRenamePolicy,
  getPolicy as firestoreGetPolicy,
  generatePolicyId,
  WELCOME_POLICY,
  type PolicyDocument
} from "@/lib/firestore-service"
import { API_ENDPOINTS } from "@/lib/api-config"
import { createShareForPolicy, type ShareExpirationPreset } from "@/lib/share-service"

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
  const { user, loading: authLoading } = useAuth()
  const [policies, setPolicies] = React.useState<string[]>([])
  const [policyDocs, setPolicyDocs] = React.useState<Map<string, PolicyDocument>>(new Map())
  const [selected, setSelected] = React.useState<string | null>(null)
  const [activePolicyContent, setActivePolicyContent] = React.useState<{ policy: string; input: string; data: string; test: string }>({
    policy: WELCOME_POLICY.policy,
    input: WELCOME_POLICY.input,
    data: WELCOME_POLICY.data,
    test: WELCOME_POLICY.test
  })
  const [output, setOutput] = React.useState<unknown>(null)
  const [activePanel, setActivePanel] = React.useState<string>("input")
  const [errors, setErrors] = React.useState<ErrorItem[]>([])
  const [lintDiagnostics, setLintDiagnostics] = React.useState<LintDiagnostic[]>([])
  const [testResults, setTestResults] = React.useState<TestResult[]>([])
  const [testSummary, setTestSummary] = React.useState<TestSummary | null>(null)
  const [evaluationTimeMs, setEvaluationTimeMs] = React.useState<number | null>(null)

  // Subscribe to Firestore policies when authenticated
  React.useEffect(() => {
    if (authLoading) return

    if (!user) {
      // Unauthenticated: Clear cloud policies, use scratchpad mode
      setPolicies([])
      setPolicyDocs(new Map())
      setSelected(null)
      // Set welcome policy content for scratchpad mode
      setActivePolicyContent({
        policy: WELCOME_POLICY.policy,
        input: WELCOME_POLICY.input,
        data: WELCOME_POLICY.data,
        test: WELCOME_POLICY.test
      })
      return
    }

    // Authenticated: Subscribe to Firestore
    const unsubscribe = subscribeToPolicies(
      user.uid,
      (policyDocuments) => {
        const policyIds = policyDocuments.map((p) => p.id)
        const docsMap = new Map<string, PolicyDocument>()
        policyDocuments.forEach((p) => docsMap.set(p.id, p))
        
        setPolicies(policyIds)
        setPolicyDocs(docsMap)
        
        // Auto-select first policy if none selected
        if (policyIds.length > 0 && !selected) {
          const firstPolicy = policyDocuments[0]
          setSelected(firstPolicy.id)
          setActivePolicyContent({
            policy: firstPolicy.policy,
            input: firstPolicy.input,
            data: firstPolicy.data,
            test: firstPolicy.test
          })
        }
      },
      (error) => {
        console.error("Failed to sync policies:", error)
        toast.error("Failed to sync policies from cloud")
      }
    )

    return () => unsubscribe()
  }, [user, authLoading, selected])

  const refresh = React.useCallback(async () => {
    // For Firestore, the subscription handles real-time updates
    // This is a no-op but kept for API compatibility
  }, [])

  const createPolicy = React.useCallback(async (id?: string, content?: { policy: string; input: string; data: string; test?: string }) => {
    if (!user) {
      toast("Sign in with GitHub to save policies", {
        action: {
          label: "Sign In",
          onClick: () => {
            // Auth context will handle this via the header button
          }
        }
      })
      return null
    }

    try {
      const newId = id || generatePolicyId(policies)
      const defaultContent = content || { 
        policy: "package main\n\ndefault allow := false", 
        input: "{}", 
        data: "{}",
        test: ""
      }

      await firestoreSavePolicy(user.uid, newId, {
        policy: defaultContent.policy,
        input: defaultContent.input,
        data: defaultContent.data,
        test: defaultContent.test || "",
        name: newId
      })

      setSelected(newId)
      setActivePolicyContent({ ...defaultContent, test: defaultContent.test || "" })
      toast.success(`Created policy ${newId}`)
      return newId
    } catch (e) {
      console.error("createPolicy error", e)
      toast.error("Failed to create policy")
      return null
    }
  }, [user, policies])

  const loadPolicy = React.useCallback(async (id: string) => {
    if (!user) {
      // In scratchpad mode, no policies to load
      return null
    }

    try {
      // First check if we have it in the local cache from subscription
      const cached = policyDocs.get(id)
      if (cached) {
        return {
          policy: cached.policy,
          input: cached.input,
          data: cached.data,
          test: cached.test
        }
      }

      // Otherwise fetch from Firestore
      const policyDoc = await firestoreGetPolicy(user.uid, id)
      if (!policyDoc) {
        toast.error("Failed to load policy")
        return null
      }
      return {
        policy: policyDoc.policy,
        input: policyDoc.input,
        data: policyDoc.data,
        test: policyDoc.test
      }
    } catch (e) {
      console.error("loadPolicy error", e)
      toast.error("Failed to load policy")
      return null
    }
  }, [user, policyDocs])

  const savePolicy = React.useCallback(async (id: string, files: { policy: string; input: string; data: string; test: string }) => {
    if (!user) {
      toast("Sign in with GitHub to save policies", {
        action: {
          label: "Sign In",
          onClick: () => {
            // Auth context will handle this via the header button
          }
        }
      })
      return false
    }

    try {
      await firestoreSavePolicy(user.uid, id, {
        policy: files.policy,
        input: files.input,
        data: files.data,
        test: files.test,
        name: id
      })
      toast.success(`Saved policy ${id}`)
      return true
    } catch (e) {
      console.error("savePolicy error", e)
      toast.error("Failed to save policy")
      return false
    }
  }, [user])

  const renamePolicy = React.useCallback(async (id: string, newId: string) => {
    if (!user) {
      toast.error("Sign in to rename policies")
      return false
    }

    try {
      await firestoreRenamePolicy(user.uid, id, newId)
      toast.success(`Renamed policy to ${newId}`)
      if (selected === id) setSelected(newId)
      return true
    } catch (e) {
      console.error("renamePolicy error", e)
      toast.error("Failed to rename policy")
      return false
    }
  }, [user, selected])

  const deletePolicy = React.useCallback(async (id: string) => {
    if (!user) {
      toast.error("Sign in to delete policies")
      return false
    }

    try {
      await firestoreDeletePolicy(user.uid, id)
      toast.success(`Deleted policy ${id}`)
      if (selected === id) {
        setSelected(null)
        // Reset to welcome policy
        setActivePolicyContent({
          policy: WELCOME_POLICY.policy,
          input: WELCOME_POLICY.input,
          data: WELCOME_POLICY.data,
          test: WELCOME_POLICY.test
        })
      }
      return true
    } catch (e) {
      console.error("deletePolicy error", e)
      toast.error("Failed to delete policy")
      return false
    }
  }, [user, selected])

  const downloadPolicy = React.useCallback(async (id: string) => {
    try {
      // Get the policy content
      const policyData = policyDocs.get(id) || (user ? await firestoreGetPolicy(user.uid, id) : null)
      
      if (!policyData && !user) {
        // For scratchpad mode, download current content
        const content = JSON.stringify({
          policy: activePolicyContent.policy,
          input: activePolicyContent.input,
          data: activePolicyContent.data,
          test: activePolicyContent.test
        }, null, 2)
        
        const blob = new Blob([content], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `scratchpad-policy.json`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        return
      }
      
      if (!policyData) {
        toast.error("Policy not found")
        return
      }

      const content = JSON.stringify({
        policy: policyData.policy,
        input: policyData.input,
        data: policyData.data,
        test: policyData.test
      }, null, 2)
      
      const blob = new Blob([content], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${id}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error("downloadPolicy error", e)
      toast.error("Failed to download policy")
    }
  }, [user, policyDocs, activePolicyContent])

  const handleEvaluate = React.useCallback(async () => {
    // Allow evaluation even without a selected policy (scratchpad mode)
    try {
      const res = await fetch(API_ENDPOINTS.evaluate, {
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
  }, [activePolicyContent]);

  const handleFormat = React.useCallback(async () => {
    // Format Rego
    try {
      const res = await fetch(API_ENDPOINTS.format, {
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
    if (!activePolicyContent.test || activePolicyContent.test.trim().length === 0) {
      toast.error("No test file content. Add tests using the flask toggle in the policy editor.");
      return;
    }

    try {
      const res = await fetch(API_ENDPOINTS.test, {
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
  }, [activePolicyContent]);

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
  const { user } = useAuth()

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

  const [hoveredContextAction, setHoveredContextAction] = React.useState<
    "edit" | "share" | "download" | "delete" | null
  >(null)

  const [contextMenu, setContextMenu] = React.useState<{
    open: boolean
    x: number
    y: number
    file?: string | null
  }>({ open: false, x: 0, y: 0, file: null })

  const [shareDialogOpen, setShareDialogOpen] = React.useState(false)
  const [shareTarget, setShareTarget] = React.useState<string | null>(null)
  const [shareExpiration, setShareExpiration] = React.useState<ShareExpirationPreset>("7d")
  const [shareUrl, setShareUrl] = React.useState<string | null>(null)
  const [shareCreating, setShareCreating] = React.useState(false)

  const [resetKeys, setResetKeys] = React.useState<Record<string, number>>({})

  const closeContext = React.useCallback(() => {
    setContextMenu((s) => ({ ...s, open: false }))
    setPendingDelete(null)
    setHoveredContextAction(null)
  }, [])

  React.useEffect(() => {
    if (!shareDialogOpen) {
      setShareTarget(null)
      setShareExpiration("7d")
      setShareUrl(null)
      setShareCreating(false)
    }
  }, [shareDialogOpen])

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
        if (!v) {
          setPendingDelete(null)
          setHoveredContextAction(null)
        }
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
              onMouseEnter={() => setHoveredContextAction("edit")}
              onMouseLeave={() => setHoveredContextAction(null)}
              onClick={() => {
                if (contextMenu.file) {
                  setEditingId(contextMenu.file)
                  closeContext()
                }
              }}
            >
              <Pencil size={16} weight={hoveredContextAction === "edit" ? "fill" : "regular"} />
              <span>Edit</span>
            </button>

            <button
              type="button"
              aria-label={contextMenu.file ? `Share ${contextMenu.file}` : "Share"}
              className="flex align-start items-center gap-2 w-full text-left text-sm px-2 py-1 rounded hover:bg-accent/50 text-foreground"
              onMouseEnter={() => setHoveredContextAction("share")}
              onMouseLeave={() => setHoveredContextAction(null)}
              onClick={() => {
                if (!contextMenu.file) return
                setShareTarget(contextMenu.file)
                setShareDialogOpen(true)
                closeContext()
              }}
            >
              <LinkSimple size={16} weight={hoveredContextAction === "share" ? "fill" : "regular"} />
              <span>Share...</span>
            </button>

            <button
              type="button"
              aria-label={contextMenu.file ? `Download ${contextMenu.file}` : "Download"}
              className="flex align-start items-center gap-2 w-full text-left text-sm px-2 py-1 rounded hover:bg-accent/50 text-foreground"
              onMouseEnter={() => setHoveredContextAction("download")}
              onMouseLeave={() => setHoveredContextAction(null)}
              onClick={() => {
                if (contextMenu.file) {
                  downloadPolicy(contextMenu.file)
                  closeContext()
                }
              }}
            >
              <DownloadSimple size={16} weight={hoveredContextAction === "download" ? "fill" : "regular"} />
              <span>Download</span>
            </button>
            <button
              type="button"
              aria-label={contextMenu.file ? `Delete ${contextMenu.file}` : "Delete"}
              className="flex align-start items-center gap-2 w-full text-left text-sm px-2 py-1 rounded hover:bg-destructive/10 text-destructive"
              onMouseEnter={() => setHoveredContextAction("delete")}
              onMouseLeave={() => setHoveredContextAction(null)}
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
              <Trash size={16} weight={hoveredContextAction === "delete" ? "fill" : "regular"} />
              <span>{pendingDelete === contextMenu.file ? "Sure?" : "Delete"}</span>
            </button>
          </div>
        </PopoverContent>
      </Popover>

      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share policy</DialogTitle>
            <DialogDescription>
              Creates a link anyone can open. They can edit, but can only save after signing in.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm text-muted-foreground">Expiration</div>
              <NativeSelect
                value={shareExpiration}
                onChange={(e) => setShareExpiration(e.target.value as ShareExpirationPreset)}
              >
                <NativeSelectOption value="1h">1 hour</NativeSelectOption>
                <NativeSelectOption value="1d">1 day</NativeSelectOption>
                <NativeSelectOption value="7d">7 days</NativeSelectOption>
                <NativeSelectOption value="30d">30 days</NativeSelectOption>
                <NativeSelectOption value="never">Never</NativeSelectOption>
              </NativeSelect>
            </div>

            {shareUrl && (
              <div className="flex items-center gap-2">
                <Input readOnly value={shareUrl} />
                <Button
                  variant="outline"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(shareUrl)
                      toast.success("Copied share link")
                    } catch {
                      toast.error("Failed to copy")
                    }
                  }}
                >
                  Copy
                </Button>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShareDialogOpen(false)}
              disabled={shareCreating}
            >
              Close
            </Button>
            <Button
              onClick={async () => {
                if (!shareTarget) return
                if (!user) {
                  toast.error("Sign in to share policies")
                  return
                }

                try {
                  setShareCreating(true)
                  const result = await createShareForPolicy({
                    userId: user.uid,
                    policyId: shareTarget,
                    expiration: shareExpiration,
                  })
                  setShareUrl(result.url)
                  try {
                    await navigator.clipboard.writeText(result.url)
                    toast.success("Share link copied")
                  } catch {
                    toast.success("Share link created")
                  }
                } catch (e) {
                  console.error("Failed to create share", e)
                  toast.error("Failed to create share link")
                } finally {
                  setShareCreating(false)
                }
              }}
              disabled={!shareTarget || shareCreating}
            >
              {shareCreating ? "Creating..." : "Create link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default FilesList
