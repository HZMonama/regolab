"use client"

import { useMemo, useState } from "react"
import { usePathname } from "next/navigation"
import { CaretRight, type Icon } from "phosphor-react"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"

export function NavMain({
  items,
}: {
  items: {
    title: string
    url?: string
    icon: Icon
    isActive?: boolean
    items?: {
      title: string
      url: string
    }[]
  }[]
}) {
  const pathname = usePathname()
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)

  // Determine which sections should be open based on current route
  const itemsWithState = useMemo(() => {
    const pathSegments = pathname.split("/").filter(Boolean)
    const firstSegment = pathSegments[0]

    return items.map((item) => {
      const sectionKey = item.title.toLowerCase()
      const isCurrentSection = firstSegment === sectionKey

      return {
        ...item,
        defaultOpen: isCurrentSection || item.isActive || false
      }
    })
  }, [items, pathname])

  return (
    <SidebarGroup>
      <SidebarMenu>
        {itemsWithState.map((item) =>
          item.items?.length ? (
            // Item with sub-items (collapsible)
            <Collapsible key={item.title} asChild defaultOpen={item.defaultOpen}>
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton 
                    tooltip={item.title}
                    onMouseEnter={() => setHoveredItem(item.title)}
                    onMouseLeave={() => setHoveredItem(null)}
                  >
                    <item.icon weight={hoveredItem === item.title ? "fill" : "regular"} />
                    <span>{item.title}</span>
                    <CaretRight weight="regular" className="ml-auto transition-transform duration-300 ease-in-out group-data-[state=open]/collapsible:rotate-90" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {item.items?.map((subItem) => {
                      const isActive = pathname === subItem.url
                      return (
                        <SidebarMenuSubItem key={subItem.title}>
                          <SidebarMenuSubButton asChild isActive={isActive}>
                            <a href={subItem.url}>
                              <span>{subItem.title}</span>
                            </a>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      )
                    })}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          ) : (
            // Item without sub-items (direct link)
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton 
                asChild 
                tooltip={item.title} 
                isActive={pathname === item.url}
                onMouseEnter={() => setHoveredItem(item.title)}
                onMouseLeave={() => setHoveredItem(null)}
              >
                <a href={item.url}>
                  <item.icon weight={hoveredItem === item.title || pathname === item.url ? "fill" : "regular"} />
                  <span>{item.title}</span>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )
        )}
      </SidebarMenu>
    </SidebarGroup>
  )
}
