"use client";

import * as React from "react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";
import { useSettings } from "@/lib/settings-context";

interface InputTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
}

interface InputTemplatePickerProps {
  onSelect: (template: Record<string, unknown>) => void;
  currentValue: string;
}

export function InputTemplatePicker({ onSelect, currentValue }: InputTemplatePickerProps) {
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState<InputTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const { settings } = useSettings();

  // Fetch templates when popover opens
  useEffect(() => {
    if (!open) return;
    
    const fetchTemplates = async () => {
      setLoading(true);
      try {
        const { API_ENDPOINTS } = await import('@/lib/api-config');
        const res = await fetch(API_ENDPOINTS.inputTemplates);
        if (!res.ok) throw new Error("Failed to fetch templates");
        const data = await res.json();
        setTemplates(data.templates || []);
      } catch (e) {
        console.error("Failed to fetch input templates:", e);
        toast.error("Failed to load input templates");
      } finally {
        setLoading(false);
      }
    };

    fetchTemplates();
  }, [open]);

  // Filter out disabled templates
  const enabledTemplates = useMemo(() => {
    const disabledIds = settings.templates.inputTemplates.disabledBuiltIn;
    return templates.filter(t => !disabledIds.includes(t.id));
  }, [templates, settings.templates.inputTemplates.disabledBuiltIn]);

  // Group templates by category
  const groupedTemplates = React.useMemo(() => {
    const groups: Record<string, InputTemplate[]> = {};
    for (const t of enabledTemplates) {
      if (!groups[t.category]) groups[t.category] = [];
      groups[t.category].push(t);
    }
    return groups;
  }, [enabledTemplates]);

  const handleSelect = useCallback(async (templateId: string) => {
    // Check if current input has content
    const hasContent = currentValue && currentValue.trim() !== "" && currentValue.trim() !== "{}";
    
    if (hasContent) {
      const confirmed = window.confirm(
        "This will replace your current input. Continue?"
      );
      if (!confirmed) {
        setOpen(false);
        return;
      }
    }

    try {
      const res = await fetch(`/api/input-templates/${templateId}`);
      if (!res.ok) throw new Error("Failed to fetch template");
      const data = await res.json();
      
      onSelect(data.template);
      toast.success(`Loaded ${data.name} template`);
      setOpen(false);
    } catch (e) {
      console.error("Failed to load template:", e);
      toast.error("Failed to load template");
    }
  }, [currentValue, onSelect]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          role="combobox"
          aria-expanded={open}
          className="h-7 gap-1  border rouned text-xs text-muted-foreground hover:text-foreground"
        >
          <span>Load Template</span>
          <ChevronsUpDown className="h-3 w-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="end">
        <Command>
          <CommandInput placeholder="Search templates..." className="h-9" />
          <CommandList>
            {loading ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Loading templates...
              </div>
            ) : (
              <>
                <CommandEmpty>No templates found.</CommandEmpty>
                {Object.entries(groupedTemplates).map(([category, categoryTemplates]) => (
                  <CommandGroup key={category} heading={category}>
                    {categoryTemplates.map((template) => (
                      <CommandItem
                        key={template.id}
                        value={`${template.name} ${template.description}`}
                        onSelect={() => handleSelect(template.id)}
                        className="flex flex-col items-start gap-1 py-2"
                      >
                        <div className="flex w-full items-center justify-between">
                          <span className="font-medium">{template.name}</span>
                        </div>
                        <span className="text-xs text-muted-foreground line-clamp-1">
                          {template.description}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ))}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
