"use client"

import * as React from "react"
import { Drawer } from "vaul"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Input } from "@/components/ui/input"
import { usePolicies } from "@/components/files-list"
import { toast } from "sonner"
import { Plus } from "phosphor-react"
import GlareHover from "@/components/GlareHover"

type Props = {
  /** controlled open state (optional) */
  open?: boolean
  /** controlled open change handler (optional) */
  onOpenChange?: (open: boolean) => void
}

interface Template {
  id: string
  category: string
  meta: {
    title: string
    description: string
    category?: string
  }
  files: {
    policy: string
    input: string
    data: string
    test?: string
  }
}

const categories = [
  "access-control",
  "api-authorization",
  "kubernetes",
  "cloud-iac",
  "cicd-pipeline",
  "multi-tenancy",
  "data-privacy",
  "contextual"
]

const categoryLabels: Record<string, string> = {
  "access-control": "Access Control",
  "api-authorization": "API Authorization",
  "kubernetes": "Kubernetes",
  "cloud-iac": "Cloud & IaC",
  "cicd-pipeline": "CI/CD Pipeline",
  "multi-tenancy": "Multi-Tenancy",
  "data-privacy": "Data Privacy",
  "contextual": "Contextual"
}

export const ExamplesDrawer: React.FC<Props> = function ExamplesDrawer(props) {
  const [internalOpen, setInternalOpen] = React.useState(false)
  const [selectedCategory, setSelectedCategory] = React.useState<string>("All")
  const [searchQuery, setSearchQuery] = React.useState("")
  const [templates, setTemplates] = React.useState<Template[]>([])
  const [loading, setLoading] = React.useState(false)

  const { createPolicy, policies } = usePolicies()

  const isControlled = props.open !== undefined
  const open = isControlled ? props.open! : internalOpen
  const setOpen = (v: boolean) => {
    if (!isControlled) setInternalOpen(v)
    props.onOpenChange?.(v)
  }

  React.useEffect(() => {
    if (open) {
      setLoading(true)
      fetch("/api/templates")
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setTemplates(data.templates)
          } else {
            toast.error("Failed to load templates")
          }
        })
        .catch(() => toast.error("Failed to load templates"))
        .finally(() => setLoading(false))
    }
  }, [open])

  const filteredTemplates = React.useMemo(() => {
    return templates.filter(t => {
      const matchesCategory = selectedCategory === "All" || t.category === selectedCategory
      const matchesSearch = t.meta.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            t.meta.description.toLowerCase().includes(searchQuery.toLowerCase())
      return matchesCategory && matchesSearch
    })
  }, [templates, selectedCategory, searchQuery])

  const handleTemplateClick = async (template: Template) => {
    let customId = template.id
    
    // If policy with this name exists, append a number
    if (policies.includes(customId)) {
      let counter = 1
      while (policies.includes(`${template.id}-${counter}`)) {
        counter++
      }
      customId = `${template.id}-${counter}`
    }
    
    const createdId = await createPolicy(customId, {
      policy: template.files.policy,
      input: template.files.input,
      data: template.files.data,
      test: template.files.test || ''
    })

    if (createdId) {
      setOpen(false)
    }
  }

  return (
    <Drawer.Root direction="right" open={open} onOpenChange={setOpen}>
      <Drawer.Portal>
        <Drawer.Content
          className="right-2 top-2 bottom-2 fixed z-60 outline-none w-[50vw] flex"
          style={{ '--initial-transform': 'calc(100% + 8px)' } as React.CSSProperties}
        >
          <div className="bg-card h-full w-full grow flex flex-col overflow-clip rounded-md border border-border font-sans relative">
            <div className="p-4 border-b border-border">
              <Drawer.Title className="text-lg font-semibold">Templates</Drawer.Title>
              <p className="text-sm text-muted-foreground">Start with a pre-built policy</p>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-4">
              {loading ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  Loading templates...
                </div>
              ) : filteredTemplates.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <p>No templates found</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {filteredTemplates.map(template => (
                    <div key={template.id} onClick={() => handleTemplateClick(template)}>
                      <GlareHover
                        width="100%"
                        height="auto"
                        borderRadius="0.5rem"
                        background="hsl(var(--card))"
                        className="cursor-pointer group relative overflow-hidden border border-border"
                      >
                        <div className="h-full w-full p-4 transition-all duration-300 group-hover:blur-[2px]">
                          <div className="flex items-center justify-between w-full mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-lg font-light font-display">{template.meta.title}</span>
                            </div>
                            <span className="text-xs font-display font-light px-2 py-1 rounded-full bg-muted text-muted-foreground">
                              {categoryLabels[template.category] || template.category}
                            </span>
                          </div>
                          <p className="text-sm font-sans text-muted-foreground line-clamp-2">
                            {template.meta.description}
                          </p>
                        </div>
                        
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                          <div className="border text-primary px-4 py-2 rounded-md font-medium flex items-center shadow-lg transform scale-95 group-hover:scale-100 transition-transform">
                            <Plus className="mr-2 text-primary" /> Use this template
                          </div>
                        </div>
                      </GlareHover>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="mt-auto bg-card py-4 px-4 flex items-center justify-between gap-2 border-t border-border">
              <NativeSelect
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full bg-zinc-950 text-white border-zinc-800"
                >
                  <NativeSelectOption value="All" className="bg-zinc-950">All Categories</NativeSelectOption>
                  {categories.map((category) => (
                    <NativeSelectOption key={category} value={category} className="bg-zinc-950">
                      {categoryLabels[category] || category}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>

              <div className="flex items-center gap-2 w-full">
                <Input
                  placeholder="Search templates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full"
                />
              </div>
            </div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}

export default ExamplesDrawer
