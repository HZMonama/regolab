"use client"

import * as React from "react"
import { BookOpen, GearSix, PlusCircle, Bookmark } from "phosphor-react"
import ConfigDrawer from "@/components/config-drawer"
import ExamplesDrawer from "@/components/examples-drawer"

import { NavMain } from "./nav-main"
import { cn } from "@/lib/utils"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenuButton,
} from "@/components/ui/sidebar"
import { Kbd } from "@/components/ui/kbd"
import Link from "next/link"
import FilesList, { usePolicies } from "@/components/files-list"

const data = {
  navMain: [],
}


export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [hoveredButton, setHoveredButton] = React.useState<string | null>(null)
  const [configOpen, setConfigOpen] = React.useState(false)
  const [examplesOpen, setExamplesOpen] = React.useState(false)
  const newPolicyButtonRef = React.useRef<HTMLButtonElement | null>(null)

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


  // policies hook
  // policies hook — call at top-level to satisfy Rules of Hooks
  const policies = usePolicies()

  


  return (
    <Sidebar
      variant="floating"
      className={cn(
        "top-(--header-total-height) h-[calc(100svh-var(--header-total-height))]",
        props.className
      )}
      {...props}
    >
      <SidebarHeader>
          <SidebarMenuButton
            asChild
            size="default"
            className="w-full bg-sidebar-accent hover:bg-sidebar-border hover:text-violet-200 text-muted-foreground"
            tooltip="New Policy"
            onMouseEnter={() => setHoveredButton("new")}
            onMouseLeave={() => setHoveredButton(null)}
          >
            <button
              ref={newPolicyButtonRef}
              onClick={async () => {
                try {
                  if (policies) {
                    await policies.createPolicy()
                  } else {
                    // fallback: create a policy via direct fetch
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
              aria-label="New Policy"
              className="w-full flex items-center justify-between gap-2"
            >
              <div className="flex items-center gap-2">
                <PlusCircle weight={hoveredButton === "new" ? "fill" : "regular"} />
                <span className="font-display">New Policy</span>
              </div>
              <div className="flex items-center gap-1">
                  <Kbd>Alt + N</Kbd>
              </div>
            </button>
          </SidebarMenuButton>
      </SidebarHeader>
      <SidebarContent className="flex flex-col">
        {data.navMain.length > 0 && <NavMain items={data.navMain} />}

        <div className="flex flex-col flex-1 min-h-0">
          <h4 className="sr-only">Files</h4>
          <div className="px-0 flex-1 min-h-0">
            <FilesList className="px-2 h-full" />
          </div>

          {/* Context menu moved into FilesList component */}
        </div>
      </SidebarContent>
      <SidebarFooter className="border-t">
        <SidebarMenuButton
          asChild
          size="default"
          className="w-full bg-sidebar-accent hover:bg-pink-900 hover:text-pink-200 text-muted-foreground"
          tooltip="Templates"
          onMouseEnter={() => setHoveredButton("templates")}
          onMouseLeave={() => setHoveredButton(null)}
        >
          <button
            onClick={() => setExamplesOpen(true)}
            aria-label="Templates"
            className="w-full flex items-center gap-2"
          >
            <Bookmark weight={hoveredButton === "templates" ? "fill" : "regular"} />
            <span>Templates</span>
          </button>
        </SidebarMenuButton>
        <ExamplesDrawer open={examplesOpen} onOpenChange={setExamplesOpen} />

        <div className="flex gap-2">
          <SidebarMenuButton
            asChild
            size="default"
            className="w-full flex-1 bg-sidebar-accent hover:bg-green-900 hover:text-green-200 text-muted-foreground"
            tooltip="Config"
            onMouseEnter={() => setHoveredButton("help")}
            onMouseLeave={() => setHoveredButton(null)}
          >
            <button
              onClick={() => setConfigOpen(true)}
              aria-label="Config"
              className="w-full flex items-center gap-2"
            >
              <GearSix weight={hoveredButton === "help" ? "fill" : "regular"} />
              <span>Config</span>
            </button>
          </SidebarMenuButton>
          <ConfigDrawer open={configOpen} onOpenChange={setConfigOpen} />

          <SidebarMenuButton
            asChild
            size="default"
            className="w-full flex-1 bg-sidebar-accent  hover:bg-blue-900 hover:text-blue-200 text-muted-foreground"
            tooltip="Documentation"
            onMouseEnter={() => setHoveredButton("docs")}
            onMouseLeave={() => setHoveredButton(null)}
          >
            <Link href="https://www.openpolicyagent.org/docs">
              <BookOpen weight={hoveredButton === "docs" ? "fill" : "regular"} />
              <span>Docs</span>
            </Link>
          </SidebarMenuButton>
        </div>
        <div>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
