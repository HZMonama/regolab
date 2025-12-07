"use client";

import * as React from "react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Drawer } from "vaul";
import { Plus, MagnifyingGlass, Database, User, Cloud, Globe, GitBranch, Shield, ChartLine, Code } from "phosphor-react";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { toast } from "sonner";
import GlareHover from "@/components/GlareHover";
import { useSettings } from "@/lib/settings-context";

interface DataSourceTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
}

interface DataSourcePickerProps {
  onInsert: (template: { name: string; template: Record<string, unknown> }) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const categoryIcons: Record<string, React.ReactNode> = {
  "Identity": <User className="h-4 w-4" />,
  "Kubernetes": <Database className="h-4 w-4" />,
  "AWS": <Cloud className="h-4 w-4" />,
  "HTTP": <Globe className="h-4 w-4" />,
  "CI/CD": <GitBranch className="h-4 w-4" />,
  "Service Mesh": <ChartLine className="h-4 w-4" />,
  "Authorization": <Shield className="h-4 w-4" />,
  "Infrastructure": <Code className="h-4 w-4" />,
};

export function DataSourcePicker({ onInsert, open: controlledOpen, onOpenChange }: DataSourcePickerProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [dataSources, setDataSources] = useState<DataSourceTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const { settings } = useSettings();

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = (v: boolean) => {
    if (!isControlled) setInternalOpen(v);
    onOpenChange?.(v);
  };

  // Fetch data sources when drawer opens
  useEffect(() => {
    if (!open) return;
    
    const fetchDataSources = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/data-sources");
        if (!res.ok) throw new Error("Failed to fetch data sources");
        const data = await res.json();
        setDataSources(data.dataSources || []);
      } catch (e) {
        console.error("Failed to fetch data sources:", e);
        toast.error("Failed to load data sources");
      } finally {
        setLoading(false);
      }
    };

    fetchDataSources();
  }, [open]);

  // Filter out disabled data sources
  const enabledDataSources = useMemo(() => {
    const disabledIds = settings.templates.dataSourceTemplates.disabledBuiltIn;
    return dataSources.filter(ds => !disabledIds.includes(ds.id));
  }, [dataSources, settings.templates.dataSourceTemplates.disabledBuiltIn]);

  // Get unique categories from enabled sources
  const categories = React.useMemo(() => {
    const cats = new Set(enabledDataSources.map(ds => ds.category));
    return Array.from(cats).sort();
  }, [enabledDataSources]);

  // Filter data sources
  const filteredSources = React.useMemo(() => {
    return enabledDataSources.filter(ds => {
      const matchesSearch = search === "" || 
        ds.name.toLowerCase().includes(search.toLowerCase()) ||
        ds.description.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = selectedCategory === "All" || ds.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [enabledDataSources, search, selectedCategory]);

  const handleSelect = useCallback(async (ds: DataSourceTemplate) => {
    try {
      const res = await fetch(`/api/data-sources/${ds.id}`);
      if (!res.ok) throw new Error("Failed to fetch template");
      const data = await res.json();
      
      onInsert({
        name: data.name,
        template: data.template,
      });
      
      if (!isControlled) setInternalOpen(false);
      onOpenChange?.(false);
      setSearch("");
      setSelectedCategory("All");
      toast.success(`Added ${data.name} data source`);
    } catch (e) {
      console.error("Failed to load template:", e);
      toast.error("Failed to load template");
    }
  }, [onInsert, isControlled, onOpenChange]);

  return (
    <Drawer.Root direction="right" open={open} onOpenChange={setOpen}>
      <Drawer.Portal>
        <Drawer.Content
          className="right-2 top-2 bottom-2 fixed z-60 outline-none w-[500px] flex"
          style={{ '--initial-transform': 'calc(100% + 8px)' } as React.CSSProperties}
        >
          <div className="bg-card h-full w-full grow flex flex-col overflow-clip rounded-md border border-border font-sans relative">
            {/* Header */}
            <div className="p-4 border-b border-border">
              <Drawer.Title className="text-lg font-semibold flex items-center gap-2">
                <Database weight="duotone" className="w-5 h-5" />
                Data Sources
              </Drawer.Title>
              <p className="text-sm text-muted-foreground">Insert pre-structured JSON data</p>
            </div>
            
            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-4">
              {loading ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  Loading data sources...
                </div>
              ) : filteredSources.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <Database className="w-8 h-8 mb-2 opacity-50" />
                  <p>No data sources found</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {filteredSources.map((ds) => (
                    <div key={ds.id} onClick={() => handleSelect(ds)}>
                      <GlareHover
                        width="100%"
                        height="auto"
                        borderRadius="0.5rem"
                        background="hsl(var(--card))"
                        className="cursor-pointer group relative overflow-hidden border border-border"
                      >
                        <div className="h-full w-full p-4 transition-all duration-300 group-hover:blur-[2px]">
                          <div className="flex items-center justify-between w-full mb-1">
                            <div className="flex items-center gap-2">
                              {categoryIcons[ds.category] || <Database className="h-4 w-4 text-muted-foreground" />}
                              <span className="text-sm font-medium font-display">{ds.name}</span>
                            </div>
                            <span className="text-xs font-display font-light px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                              {ds.category}
                            </span>
                          </div>
                          <p className="text-xs font-sans text-muted-foreground line-clamp-2 ml-6">
                            {ds.description}
                          </p>
                        </div>
                        
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                          <div className="border text-primary px-3 py-1.5 rounded-md font-medium flex items-center text-sm shadow-lg transform scale-95 group-hover:scale-100 transition-transform">
                            <Plus className="mr-1.5 text-primary" weight="bold" /> Insert
                          </div>
                        </div>
                      </GlareHover>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* Footer with filters */}
            <div className="mt-auto bg-card py-4 px-4 flex items-center justify-between gap-2 border-t border-border">
              <NativeSelect
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full bg-zinc-950 text-white border-zinc-800"
              >
                <NativeSelectOption value="All" className="bg-zinc-950">All</NativeSelectOption>
                {categories.map((category) => (
                  <NativeSelectOption key={category} value={category} className="bg-zinc-950">
                    {category}
                  </NativeSelectOption>
                ))}
              </NativeSelect>

              <div className="relative w-full">
                <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9"
                />
              </div>
            </div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
