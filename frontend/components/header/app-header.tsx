"use client"

import * as React from "react"
import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { PolicyPanelToggle } from "@/components/policy-panel"
import { Combobox } from "@/components/ui/combobox"
import { Kbd } from "@/components/ui/kbd"
import { usePolicies } from "@/components/files-list"

export function AppHeader() {
  const { selected, activePolicyContent, savePolicy, handleEvaluate, handleFormat, handleTest } = usePolicies();

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
          <span>RegoLab.sh</span>
          <span className="ml-3 inline-flex items-center rounded-full border border-emerald-500 text-emerald-700 text-xs font-medium px-2 py-0.2 bg-transparent">v2.1.0</span>
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
            <Button 
              data-shortcut="save" 
              variant="outline" 
              className="h-9 px-3"
              onClick={handleSave}
              disabled={!selected}
            >
              <span className="font-display">Save</span> <Kbd className="ml-2">Alt+S</Kbd>
            </Button>
          </div>
        </div>
      </div>
    </header>
  )
}

export default AppHeader
