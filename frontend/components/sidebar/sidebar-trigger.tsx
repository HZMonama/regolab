"use client"

import * as React from "react"
import { Kbd } from "@/components/ui/kbd"
import { SidebarSimple } from "phosphor-react"
import { useSidebar } from "@/components/ui/sidebar"

export function SidebarHeaderTrigger() {
  const { toggleSidebar, open } = useSidebar()
  const [isHovering, setIsHovering] = React.useState(false)

  return (
    <div
      className="h-full inline-flex items-center gap-1.5"
      role="button"
      tabIndex={0}
      onClick={() => toggleSidebar()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
          e.preventDefault()
          toggleSidebar()
        }
      }}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      aria-label="Toggle sidebar"
      aria-expanded={open}
    >
      <SidebarSimple className="h-6 w-6" weight={isHovering ? "fill" : "regular"} />
      <span className="inline-flex items-center gap-1">
        <Kbd>Ctrl + B</Kbd>
      </span>
    </div>
  )
}

export default SidebarHeaderTrigger
