"use client"

import * as React from "react"
import { useEffect, useState } from "react"
import { Rocket } from "phosphor-react"
import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import { PolicyPanelToggle } from "@/components/policy-panel"
import { Combobox } from "@/components/ui/combobox"
import { Kbd } from "@/components/ui/kbd"
import { usePolicies } from "@/components/files-list"
import { Drawer } from "vaul"

export function AppHeader() {
  const { selected, activePolicyContent, savePolicy, handleEvaluate, handleFormat, handleTest } = usePolicies();
  const [exportOpen, setExportOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!e.altKey) return;
      const key = e.key.toLowerCase();
      const map: Record<string, string> = { f: "format", s: "save", e: "evaluate", t: "test", r: "evaluate" };
      const action = map[key];
      if (!action) return;
      e.preventDefault();
      const btn = document.querySelector(`[data-shortcut="${action}"]`) as HTMLButtonElement | null;
      if (btn) btn.click();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleSave = async () => {
    if (selected) {
      await savePolicy(selected, activePolicyContent);
    }
  };

  return (
    <header className="fixed inset-x-0 top-0 z-50 h-(--header-total-height)">
      <div className="max-w-7xl mx-2 mt-(--header-offset) h-(--header-height) flex items-center px-2 bg-card shadow-sm rounded-md border">
        <div className="flex h-full items-center">
          <PolicyPanelToggle />
        </div>

        <div className="flex-1 text-2xl text-gray-400 font-display ml-4 flex items-center">
          <span>RegoLab Cloud</span>
        </div>
        <div className="flex items-center gap-2">
          <Combobox />
          <div className="flex items-center gap-2">
            <Button 
              data-shortcut="format" 
              variant="outline" 
              className="h-9 px-3"
              onClick={handleFormat}
            >
              <span className="font-display">Format</span> <Kbd className="ml-2">Alt+F</Kbd>
            </Button>
            <Button 
              data-shortcut="test" 
              variant="outline" 
              className="h-9 px-3"
              onClick={handleTest}
            >
              <span className="font-display">Test</span> <Kbd className="ml-2">Alt+T</Kbd>
            </Button>
            <Button 
              data-shortcut="evaluate" 
              variant="outline" 
              className="h-9 px-3"
              onClick={handleEvaluate}
            >
              <span className="font-display">Run</span> <Kbd className="ml-2">Alt+R</Kbd>
            </Button>
            <ButtonGroup>
              <Button 
                data-shortcut="save" 
                variant="outline" 
                className="h-9 px-3"
                onClick={handleSave}
                disabled={!selected}
              >
                <span className="font-display">Save</span> <Kbd className="ml-2">Alt+S</Kbd>
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={() => setExportOpen(true)}
                disabled={!selected}
              >
                <Rocket className="w-4 h-4" />
              </Button>
            </ButtonGroup>
          </div>
        </div>
      </div>
      
      <Drawer.Root open={exportOpen} onOpenChange={setExportOpen}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 bg-black/40 z-50" />
          <Drawer.Content className="bg-card flex flex-col rounded-t-[10px] h-[80%] mt-24 fixed bottom-0 left-0 right-0 z-50">
            <div className="p-4 bg-card rounded-t-[10px] flex-1 overflow-auto">
              <div className="mx-auto w-12 h-1.5 shrink-0 rounded-full bg-muted mb-8" />
              <div className="max-w-4xl mx-auto">
                <Drawer.Title className="font-display text-2xl mb-4">
                  Export Policy
                </Drawer.Title>
                {/* TODO: Add export functionality */}
              </div>
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </header>
  )
}

export default AppHeader
