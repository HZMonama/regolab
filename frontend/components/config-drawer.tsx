"use client";

import * as React from "react";
import { useState, useCallback } from "react";
import { Drawer } from "vaul";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { useSettings } from "@/lib/settings-context";
import { 
  Gear, 
  TextAa, 
  TextAlignLeft, 
  FloppyDisk, 
  Lightning,
  MagnifyingGlass,
  ArrowsClockwise,
  CheckCircle,
  ArrowSquareOut,
} from "phosphor-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Props = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

// ============================================================================
// Toggle Button Component
// ============================================================================

function ToggleButton({ 
  enabled, 
  onToggle,
  enabledLabel = "Enabled",
  disabledLabel = "Disabled",
}: { 
  enabled: boolean; 
  onToggle: (value: boolean) => void;
  enabledLabel?: string;
  disabledLabel?: string;
}) {
  return (
    <ButtonGroup>
      <Button
        size="sm"
        className={cn(
          "text-xs px-3",
          enabled 
            ? "bg-emerald-600 text-white hover:bg-emerald-700" 
            : "bg-zinc-800 text-muted-foreground border border-border hover:bg-zinc-700"
        )}
        onClick={() => onToggle(true)}
      >
        {enabledLabel}
      </Button>
      <Button
        size="sm"
        className={cn(
          "text-xs px-3",
          !enabled 
            ? "bg-red-600 text-white hover:bg-red-700" 
            : "bg-zinc-800 text-muted-foreground border border-border hover:bg-zinc-700"
        )}
        onClick={() => onToggle(false)}
      >
        {disabledLabel}
      </Button>
    </ButtonGroup>
  );
}

// ============================================================================
// Slider Component
// ============================================================================

function Slider({
  value,
  onChange,
  min,
  max,
  step = 1,
  label,
}: {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  label?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
      />
      <span className="text-sm text-foreground font-mono w-12 text-right">
        {value}{label}
      </span>
    </div>
  );
}

// ============================================================================
// Main Config Drawer Component
// ============================================================================

export const ConfigDrawer: React.FC<Props> = function ConfigDrawer(props) {
  const [internalOpen, setInternalOpen] = useState(false);
  const {
    settings,
    updateEditorSettings,
    updateLintingSettings,
    versionInfo,
    checkForUpdates,
    isCheckingUpdates,
    resetSettings,
  } = useSettings();

  const isControlled = props.open !== undefined;
  const open = isControlled ? props.open! : internalOpen;
  const setOpen = (v: boolean) => {
    if (!isControlled) setInternalOpen(v);
    props.onOpenChange?.(v);
  };

  const handleResetSettings = useCallback(() => {
    if (window.confirm("Reset all settings to defaults? This cannot be undone.")) {
      resetSettings();
      toast.success("Settings reset to defaults");
    }
  }, [resetSettings]);

  return (
    <Drawer.Root direction="right" open={open} onOpenChange={setOpen}>
      <Drawer.Portal>
        <Drawer.Content
          className="right-2 top-2 bottom-2 fixed z-60 outline-none w-[420px] flex"
          style={{ '--initial-transform': 'calc(100% + 8px)' } as React.CSSProperties}
        >
          <div className="bg-card h-full w-full grow flex flex-col overflow-clip rounded-md border border-border font-sans relative">
            {/* Header */}
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Gear weight="duotone" className="w-5 h-5" />
                <Drawer.Title className="text-lg font-semibold font-display">
                  Config
                </Drawer.Title>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs text-muted-foreground hover:text-foreground border border-dashed border-muted-foreground/50 hover:border-solid hover:border-muted-foreground"
                  onClick={handleResetSettings}
                >
                  Reset All
                </Button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              
              {/* ============================================================ */}
              {/* 1. Editor Settings */}
              {/* ============================================================ */}
              <section>
                <h3 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
                  <TextAa weight="duotone" className="w-4 h-4" />
                  Editor
                </h3>
                <p className="text-xs text-muted-foreground mb-3">
                  Settings that affect how the code editors behave and look.
                </p>
                
                <div className="space-y-4">
                  {/* Font Size */}
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">
                      Font Size
                    </label>
                    <Slider
                      value={settings.editor.fontSize}
                      onChange={(v) => updateEditorSettings({ fontSize: v })}
                      min={10}
                      max={24}
                      label="px"
                    />
                  </div>
                  
                  {/* Line Wrap */}
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm text-foreground flex items-center gap-2">
                        <TextAlignLeft className="w-4 h-4 text-muted-foreground" />
                        Line Wrap
                      </span>
                      <p className="text-xs text-muted-foreground">
                        Wrap long lines instead of horizontal scrolling
                      </p>
                    </div>
                    <ToggleButton
                      enabled={settings.editor.lineWrap}
                      onToggle={(v) => updateEditorSettings({ lineWrap: v })}
                      enabledLabel="On"
                      disabledLabel="Off"
                    />
                  </div>
                  
                  {/* Auto Format */}
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm text-foreground flex items-center gap-2">
                        <Lightning className="w-4 h-4 text-muted-foreground" />
                        Auto Format
                      </span>
                      <p className="text-xs text-muted-foreground">
                        Format Rego and JSON on evaluation
                      </p>
                    </div>
                    <ToggleButton
                      enabled={settings.editor.autoFormat}
                      onToggle={(v) => updateEditorSettings({ autoFormat: v })}
                      enabledLabel="On"
                      disabledLabel="Off"
                    />
                  </div>
                  
                  {/* Auto Save */}
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm text-foreground flex items-center gap-2">
                        <FloppyDisk className="w-4 h-4 text-muted-foreground" />
                        Auto Save
                      </span>
                      <p className="text-xs text-muted-foreground">
                        Save changes automatically after editing
                      </p>
                    </div>
                    <ToggleButton
                      enabled={settings.editor.autoSave}
                      onToggle={(v) => updateEditorSettings({ autoSave: v })}
                      enabledLabel="On"
                      disabledLabel="Off"
                    />
                  </div>
                  
                  {/* Auto Save Delay (only shown when auto save is on) */}
                  {settings.editor.autoSave && (
                    <div className="ml-6 border-l-2 border-border pl-3">
                      <label className="text-xs text-muted-foreground mb-1 block">
                        Auto Save Delay
                      </label>
                      <Slider
                        value={settings.editor.autoSaveDelay}
                        onChange={(v) => updateEditorSettings({ autoSaveDelay: v })}
                        min={500}
                        max={5000}
                        step={250}
                        label="ms"
                      />
                    </div>
                  )}
                </div>
              </section>

              {/* Dashed separator */}
              <div className="border-t border-dashed border-border" />

              {/* ============================================================ */}
              {/* 2. Linting & Validation */}
              {/* ============================================================ */}
              <section>
                <h3 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
                  <MagnifyingGlass weight="duotone" className="w-4 h-4" />
                  Linting & Validation
                </h3>
                <p className="text-xs text-muted-foreground mb-3">
                  Controls how strict the playground should be about policy correctness.
                </p>
                
                <div className="space-y-4">
                  {/* Live Linting */}
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm text-foreground">Live Linting</span>
                      <p className="text-xs text-muted-foreground">
                        Lint as you type (disable for performance)
                      </p>
                    </div>
                    <ToggleButton
                      enabled={settings.linting.liveLinting}
                      onToggle={(v) => updateLintingSettings({ liveLinting: v })}
                      enabledLabel="On"
                      disabledLabel="Off"
                    />
                  </div>
                  
                  {/* Strict Mode */}
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm text-foreground">Strict Mode</span>
                      <p className="text-xs text-muted-foreground">
                        Extra checks: unused vars, deprecated syntax, unsafe refs
                      </p>
                    </div>
                    <ToggleButton
                      enabled={settings.linting.strictMode}
                      onToggle={(v) => updateLintingSettings({ strictMode: v })}
                      enabledLabel="On"
                      disabledLabel="Off"
                    />
                  </div>
                </div>
              </section>

              {/* Dashed separator */}
              <div className="border-t border-dashed border-border" />

              {/* ============================================================ */}
              {/* 3. Updates */}
              {/* ============================================================ */}
              <section>
                <h3 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
                  <ArrowsClockwise weight="duotone" className="w-4 h-4" />
                  Updates
                </h3>
                <p className="text-xs text-muted-foreground mb-3">
                  Check for new versions of RegoLab.
                </p>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-zinc-900/30">
                    <div>
                      <span className="text-sm text-foreground">Current Version</span>
                      <p className="text-xs text-muted-foreground font-mono">
                        v{versionInfo.current}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs"
                      onClick={checkForUpdates}
                      disabled={isCheckingUpdates}
                    >
                      {isCheckingUpdates ? (
                        <>
                          <ArrowsClockwise className="w-3 h-3 mr-1 animate-spin" />
                          Checking...
                        </>
                      ) : (
                        <>
                          <ArrowsClockwise className="w-3 h-3 mr-1" />
                          Check for Updates
                        </>
                      )}
                    </Button>
                  </div>
                  
                  {versionInfo.latest && (
                    <div className={cn(
                      "p-3 rounded-lg border",
                      versionInfo.updateAvailable 
                        ? "border-emerald-700/50 bg-emerald-900/20" 
                        : "border-border bg-zinc-900/30"
                    )}>
                      {versionInfo.updateAvailable ? (
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-sm text-emerald-400 font-medium">
                              Update Available!
                            </span>
                            <p className="text-xs text-muted-foreground font-mono">
                              v{versionInfo.latest}
                            </p>
                          </div>
                          {versionInfo.releaseUrl && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs border-emerald-700 text-emerald-400 hover:bg-emerald-900/30"
                              onClick={() => window.open(versionInfo.releaseUrl!, '_blank')}
                            >
                              <ArrowSquareOut className="w-3 h-3 mr-1" />
                              View Release
                            </Button>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-emerald-500" weight="fill" />
                          <span className="text-sm text-foreground">You&apos;re up to date!</span>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {versionInfo.checkedAt && (
                    <p className="text-xs text-muted-foreground text-center">
                      Last checked: {new Date(versionInfo.checkedAt).toLocaleString()}
                    </p>
                  )}
                </div>
              </section>

            </div>

            {/* footer removed — close action moved into header */}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
};

export default ConfigDrawer;

