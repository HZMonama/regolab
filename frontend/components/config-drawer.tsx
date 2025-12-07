"use client";

import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import { Drawer } from "vaul";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { 
  useSettings, 
  type InputTemplate, 
  type DataSourceTemplate 
} from "@/lib/settings-context";
import { 
  Gear, 
  TextAa, 
  TextAlignLeft, 
  FloppyDisk, 
  Lightning,
  MagnifyingGlass,
  Warning,
  Folder,
  Trash,
  ArrowsClockwise,
  CheckCircle,
  XCircle,
  CaretDown,
  CaretRight,
  Database,
  FileCode,
  ArrowSquareOut,
  Info,
} from "phosphor-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

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
// Collapsible Section Component
// ============================================================================

function CollapsibleSection({
  title,
  icon,
  children,
  defaultOpen = false,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 p-3 bg-zinc-900/50 hover:bg-zinc-900 transition-colors"
      >
        {isOpen ? (
          <CaretDown className="w-4 h-4 text-muted-foreground" />
        ) : (
          <CaretRight className="w-4 h-4 text-muted-foreground" />
        )}
        {icon}
        <span className="text-sm font-medium">{title}</span>
      </button>
      {isOpen && (
        <div className="p-3 space-y-3 border-t border-border">
          {children}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Template List Item
// ============================================================================

function TemplateListItem({
  name,
  description,
  category,
  isEnabled,
  isBuiltIn,
  onToggle,
  onRemove,
}: {
  name: string;
  description: string;
  category: string;
  isEnabled: boolean;
  isBuiltIn: boolean;
  onToggle: () => void;
  onRemove?: () => void;
}) {
  return (
    <div className={cn(
      "flex items-center justify-between p-2 rounded-md border",
      isEnabled ? "border-border bg-zinc-900/30" : "border-border/50 bg-zinc-900/10 opacity-60"
    )}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{name}</span>
          <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 text-muted-foreground">
            {category}
          </span>
          {!isBuiltIn && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-blue-900/50 text-blue-400">
              Custom
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">{description}</p>
      </div>
      <div className="flex items-center gap-1 ml-2">
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0"
          onClick={onToggle}
        >
          {isEnabled ? (
            <CheckCircle className="w-4 h-4 text-emerald-500" weight="fill" />
          ) : (
            <XCircle className="w-4 h-4 text-muted-foreground" />
          )}
        </Button>
        {!isBuiltIn && onRemove && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
            onClick={onRemove}
          >
            <Trash className="w-4 h-4" />
          </Button>
        )}
      </div>
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
    disableBuiltInInputTemplate,
    enableBuiltInInputTemplate,
    removeCustomInputTemplate,
    disableBuiltInDataSource,
    enableBuiltInDataSource,
    removeCustomDataSource,
    versionInfo,
    checkForUpdates,
    isCheckingUpdates,
    resetSettings,
  } = useSettings();

  // Built-in templates from backend
  const [builtInInputTemplates, setBuiltInInputTemplates] = useState<InputTemplate[]>([]);
  const [builtInDataSources, setBuiltInDataSources] = useState<DataSourceTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  const isControlled = props.open !== undefined;
  const open = isControlled ? props.open! : internalOpen;
  const setOpen = (v: boolean) => {
    if (!isControlled) setInternalOpen(v);
    props.onOpenChange?.(v);
  };

  // Fetch built-in templates when drawer opens
  useEffect(() => {
    if (!open) return;

    const fetchTemplates = async () => {
      setLoadingTemplates(true);
      try {
        const [inputRes, dataRes] = await Promise.all([
          fetch("/api/input-templates"),
          fetch("/api/data-sources"),
        ]);
        
        if (inputRes.ok) {
          const data = await inputRes.json();
          setBuiltInInputTemplates(
            (data.templates || []).map((t: InputTemplate) => ({ ...t, isBuiltIn: true }))
          );
        }
        
        if (dataRes.ok) {
          const data = await dataRes.json();
          setBuiltInDataSources(
            (data.dataSources || []).map((t: DataSourceTemplate) => ({ ...t, isBuiltIn: true }))
          );
        }
      } catch (e) {
        console.error("Failed to fetch templates:", e);
      } finally {
        setLoadingTemplates(false);
      }
    };

    fetchTemplates();
  }, [open]);

  // Combine built-in and custom templates
  const allInputTemplates = [
    ...builtInInputTemplates,
    ...settings.templates.inputTemplates.custom,
  ];
  
  const allDataSources = [
    ...builtInDataSources,
    ...settings.templates.dataSourceTemplates.custom,
  ];

  const isInputTemplateEnabled = useCallback((id: string, isBuiltIn: boolean) => {
    if (isBuiltIn) {
      return !settings.templates.inputTemplates.disabledBuiltIn.includes(id);
    }
    return true; // Custom templates are always "enabled" (they exist)
  }, [settings.templates.inputTemplates.disabledBuiltIn]);

  const isDataSourceEnabled = useCallback((id: string, isBuiltIn: boolean) => {
    if (isBuiltIn) {
      return !settings.templates.dataSourceTemplates.disabledBuiltIn.includes(id);
    }
    return true;
  }, [settings.templates.dataSourceTemplates.disabledBuiltIn]);

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
                  Settings
                </Drawer.Title>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs text-muted-foreground hover:text-foreground"
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
                  
                  {/* Directory Package Mismatch */}
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <span className="text-sm text-foreground flex items-center gap-2">
                        <Folder className="w-4 h-4 text-muted-foreground" />
                        Directory/Package Mismatch
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button className="text-muted-foreground hover:text-foreground">
                              <Info className="w-3.5 h-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs">
                            <p className="text-xs">
                              <strong>Recommended: Off</strong><br />
                              RegoLab stores policies flat, not in directories matching package paths. 
                              This check expects <code>package foo.bar</code> to be in <code>foo/bar/policy.rego</code>.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </span>
                      <p className="text-xs text-muted-foreground">
                        Warn when package path doesn&apos;t match directory
                      </p>
                    </div>
                    <ToggleButton
                      enabled={settings.linting.directoryPackageMismatch}
                      onToggle={(v) => updateLintingSettings({ directoryPackageMismatch: v })}
                      enabledLabel="On"
                      disabledLabel="Off"
                    />
                  </div>
                  
                  {settings.linting.directoryPackageMismatch && (
                    <div className="flex items-start gap-2 p-2 rounded bg-amber-900/20 border border-amber-700/50">
                      <Warning className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-200">
                        This check may produce false positives because RegoLab uses flat storage, 
                        not directory-based package organization.
                      </p>
                    </div>
                  )}
                </div>
              </section>

              {/* ============================================================ */}
              {/* 3. Templates */}
              {/* ============================================================ */}
              <section>
                <h3 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
                  <FileCode weight="duotone" className="w-4 h-4" />
                  Templates
                </h3>
                <p className="text-xs text-muted-foreground mb-3">
                  Manage built-in and custom templates for Input and Data panels.
                </p>
                
                <div className="space-y-3">
                  {/* Input Templates */}
                  <CollapsibleSection
                    title={`Input Templates (${allInputTemplates.length})`}
                    icon={<FileCode className="w-4 h-4 text-muted-foreground" />}
                  >
                    {loadingTemplates ? (
                      <p className="text-xs text-muted-foreground">Loading templates...</p>
                    ) : allInputTemplates.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No templates available</p>
                    ) : (
                      <div className="space-y-2 max-h-[200px] overflow-y-auto">
                        {allInputTemplates.map((t) => (
                          <TemplateListItem
                            key={t.id}
                            name={t.name}
                            description={t.description}
                            category={t.category}
                            isBuiltIn={t.isBuiltIn}
                            isEnabled={isInputTemplateEnabled(t.id, t.isBuiltIn)}
                            onToggle={() => {
                              if (t.isBuiltIn) {
                                if (isInputTemplateEnabled(t.id, true)) {
                                  disableBuiltInInputTemplate(t.id);
                                } else {
                                  enableBuiltInInputTemplate(t.id);
                                }
                              }
                            }}
                            onRemove={!t.isBuiltIn ? () => removeCustomInputTemplate(t.id) : undefined}
                          />
                        ))}
                      </div>
                    )}
                  </CollapsibleSection>
                  
                  {/* Data Source Templates */}
                  <CollapsibleSection
                    title={`Data Source Templates (${allDataSources.length})`}
                    icon={<Database className="w-4 h-4 text-muted-foreground" />}
                  >
                    {loadingTemplates ? (
                      <p className="text-xs text-muted-foreground">Loading templates...</p>
                    ) : allDataSources.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No data sources available</p>
                    ) : (
                      <div className="space-y-2 max-h-[200px] overflow-y-auto">
                        {allDataSources.map((t) => (
                          <TemplateListItem
                            key={t.id}
                            name={t.name}
                            description={t.description}
                            category={t.category}
                            isBuiltIn={t.isBuiltIn}
                            isEnabled={isDataSourceEnabled(t.id, t.isBuiltIn)}
                            onToggle={() => {
                              if (t.isBuiltIn) {
                                if (isDataSourceEnabled(t.id, true)) {
                                  disableBuiltInDataSource(t.id);
                                } else {
                                  enableBuiltInDataSource(t.id);
                                }
                              }
                            }}
                            onRemove={!t.isBuiltIn ? () => removeCustomDataSource(t.id) : undefined}
                          />
                        ))}
                      </div>
                    )}
                  </CollapsibleSection>
                </div>
              </section>

              {/* ============================================================ */}
              {/* 4. Updates */}
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

