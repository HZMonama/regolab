"use client"

import * as React from "react"
import { BookOpen, GearSix, PlusCircle, Bookmark, GithubLogo, SignOut } from "phosphor-react"
import ConfigDrawer from "@/components/config-drawer"
import ExamplesDrawer from "@/components/examples-drawer"
import { cn } from "@/lib/utils"
import { Kbd } from "@/components/ui/kbd"
import Link from "next/link"
import FilesList, { usePolicies } from "@/components/files-list"
import { PanelLeftIcon } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface PolicyPanelProps {
  className?: string
}

// Context to manage panel state
interface PolicyPanelContextValue {
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  toggle: () => void
}

const PolicyPanelContext = React.createContext<PolicyPanelContextValue | null>(null)

export function usePolicyPanel() {
  const ctx = React.useContext(PolicyPanelContext)
  if (!ctx) throw new Error("usePolicyPanel must be used within PolicyPanelProvider")
  return ctx
}

export function PolicyPanelProvider({ 
  children,
  defaultOpen = true 
}: { 
  children: React.ReactNode
  defaultOpen?: boolean 
}) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen)

  const toggle = React.useCallback(() => {
    setIsOpen(prev => !prev)
  }, [])

  // Keyboard shortcut: Ctrl+B to toggle
  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key.toLowerCase() === "b" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        toggle()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [toggle])

  const value = React.useMemo(() => ({
    isOpen,
    setIsOpen,
    toggle,
  }), [isOpen, toggle])

  return (
    <PolicyPanelContext.Provider value={value}>
      {children}
    </PolicyPanelContext.Provider>
  )
}

export function PolicyPanel({ className }: PolicyPanelProps) {
  const { isOpen } = usePolicyPanel()
  const [hoveredButton, setHoveredButton] = React.useState<string | null>(null)
  const [configOpen, setConfigOpen] = React.useState(false)
  const [examplesOpen, setExamplesOpen] = React.useState(false)
  const [authMenuOpen, setAuthMenuOpen] = React.useState(false)
  const newPolicyButtonRef = React.useRef<HTMLButtonElement | null>(null)

  // policies hook
  const policies = usePolicies()
  
  // auth hook
  const { user, loading: authLoading, signInWithGithub, signOut } = useAuth()

  // Alt+N shortcut for new policy
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key.toLowerCase() === "n" && e.altKey) {
        e.preventDefault()
        newPolicyButtonRef.current?.click()
      }
    }

    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  return (
    <div 
      className={cn(
        "flex flex-col h-full bg-sidebar text-sidebar-foreground transition-[width,opacity,padding] duration-200 ease-in-out overflow-hidden rounded-lg border border-sidebar-border",
        isOpen ? "w-64 opacity-100" : "w-0 opacity-0 p-0 border-0",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-2 shrink-0">
        <button
          ref={newPolicyButtonRef}
          onClick={async () => {
            try {
              if (policies) {
                await policies.createPolicy()
              } else {
                const newId = `policy-${Date.now()}`
                await fetch(`/policies/${encodeURIComponent(newId)}`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ id: newId, files: {} }),
                })
              }
            } catch (e) {
              console.error("New policy failed", e)
            }
          }}
          disabled={!user}
          aria-label="New Policy"
          onMouseEnter={() => setHoveredButton("new")}
          onMouseLeave={() => setHoveredButton(null)}
          className="flex-1 flex items-center justify-between gap-2 px-3 py-2 rounded-md bg-sidebar-accent hover:bg-sidebar-border hover:text-violet-200 text-muted-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-sidebar-accent disabled:hover:text-muted-foreground"
        >
          <div className="flex items-center gap-2">
            <PlusCircle weight={hoveredButton === "new" ? "fill" : "regular"} className="w-4 h-4" />
            <span className="text-sm font-display">New Policy</span>
          </div>
          <Kbd>Alt+N</Kbd>
        </button>
      </div>

      {/* Files List */}
      <div className="flex-1 overflow-hidden min-h-0">
        <FilesList className="px-2 h-full" />
      </div>

      {/* Footer Actions */}
      <div className="p-2 border-t border-sidebar-border shrink-0 space-y-2">
        {/* Auth Button */}
        {authLoading ? (
          <div className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-sidebar-accent text-muted-foreground">
            <div className="w-4 h-4 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Loading...</span>
          </div>
        ) : user ? (
          <Popover open={authMenuOpen} onOpenChange={setAuthMenuOpen}>
            <PopoverTrigger asChild>
              <button
                onContextMenu={(e) => {
                  e.preventDefault()
                  setAuthMenuOpen(true)
                }}
                onMouseEnter={() => setHoveredButton("github")}
                onMouseLeave={() => setHoveredButton(null)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-md bg-sidebar-accent hover:bg-purple-900 hover:text-purple-200 text-muted-foreground transition-colors"
              >
                {user.photoURL ? (
                  <img 
                    src={user.photoURL} 
                    alt={user.displayName || 'User'} 
                    className="w-5 h-5 rounded-full"
                  />
                ) : (
                  <GithubLogo weight={hoveredButton === "github" ? "fill" : "regular"} className="w-4 h-4" />
                )}
                <span className="text-sm truncate flex-1 text-left">
                  {user.displayName || user.email || 'Signed in'}
                </span>
              </button>
            </PopoverTrigger>
            <PopoverContent 
              side="top" 
              align="start" 
              className="w-56 p-1"
            >
              <button
                onClick={() => {
                  signOut()
                  setAuthMenuOpen(false)
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-destructive/10 hover:text-destructive text-sm transition-colors"
              >
                <SignOut className="w-4 h-4" />
                <span>Sign out</span>
              </button>
            </PopoverContent>
          </Popover>
        ) : (
          <button
            onClick={signInWithGithub}
            onMouseEnter={() => setHoveredButton("github")}
            onMouseLeave={() => setHoveredButton(null)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md bg-sidebar-accent hover:bg-purple-900 hover:text-purple-200 text-muted-foreground transition-colors"
          >
            <GithubLogo weight={hoveredButton === "github" ? "fill" : "regular"} className="w-4 h-4" />
            <span className="text-sm">Sign in with GitHub</span>
          </button>
        )}

        <button
          onClick={() => setExamplesOpen(true)}
          onMouseEnter={() => setHoveredButton("templates")}
          onMouseLeave={() => setHoveredButton(null)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-md bg-sidebar-accent hover:bg-pink-900 hover:text-pink-200 text-muted-foreground transition-colors"
        >
          <Bookmark weight={hoveredButton === "templates" ? "fill" : "regular"} className="w-4 h-4" />
          <span className="text-sm">Templates</span>
        </button>
        <ExamplesDrawer open={examplesOpen} onOpenChange={setExamplesOpen} />

        <div className="flex gap-2">
          <button
            onClick={() => setConfigOpen(true)}
            onMouseEnter={() => setHoveredButton("config")}
            onMouseLeave={() => setHoveredButton(null)}
            className="flex-1 flex items-center gap-2 px-3 py-2 rounded-md bg-sidebar-accent hover:bg-green-900 hover:text-green-200 text-muted-foreground transition-colors"
          >
            <GearSix weight={hoveredButton === "config" ? "fill" : "regular"} className="w-4 h-4" />
            <span className="text-sm">Config</span>
          </button>
          <ConfigDrawer open={configOpen} onOpenChange={setConfigOpen} />

          <Link
            href="https://www.openpolicyagent.org/docs"
            target="_blank"
            onMouseEnter={() => setHoveredButton("docs")}
            onMouseLeave={() => setHoveredButton(null)}
            className="flex-1 flex items-center gap-2 px-3 py-2 rounded-md bg-sidebar-accent hover:bg-blue-900 hover:text-blue-200 text-muted-foreground transition-colors"
          >
            <BookOpen weight={hoveredButton === "docs" ? "fill" : "regular"} className="w-4 h-4" />
            <span className="text-sm">Docs</span>
          </Link>
        </div>
      </div>
    </div>
  )
}

// Toggle button component for header or elsewhere
export function PolicyPanelToggle({ className }: { className?: string }) {
  const { isOpen, toggle } = usePolicyPanel()

  return (
    <button
      onClick={toggle}
      aria-label={isOpen ? "Hide Policy Panel" : "Show Policy Panel"}
      className={cn(
        "inline-flex items-center gap-2 h-8 px-2 rounded-md text-muted-foreground hover:bg-accent",
        className
      )}
    >
      <PanelLeftIcon className="w-4 h-4 stroke-current text-muted-foreground group-hover:text-foreground group-hover:fill-current group-hover:stroke-none transition-colors" />
      <Kbd>Ctrl+B</Kbd>
    </button>
  )
}

export default PolicyPanel
