"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";

// ============================================================================
// Types
// ============================================================================

export interface InputTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  template: Record<string, unknown>;
  isBuiltIn: boolean;
}

export interface DataSourceTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  template: Record<string, unknown>;
  isBuiltIn: boolean;
}

export interface EditorSettings {
  fontSize: number;        // 12-24, default 14
  lineWrap: boolean;       // default true
  autoFormat: boolean;     // default false - format on eval
  autoSave: boolean;       // default false
  autoSaveDelay: number;   // ms, default 1000
}

export interface LintingSettings {
  strictMode: boolean;           // default false - uses opa check --strict
  directoryPackageMismatch: boolean; // default false - warn about package/dir mismatch
  liveLinting: boolean;          // default true - lint as you type
}

export interface TemplateSettings {
  inputTemplates: {
    disabledBuiltIn: string[];   // IDs of disabled built-in templates
    custom: InputTemplate[];     // User-added templates
  };
  dataSourceTemplates: {
    disabledBuiltIn: string[];   // IDs of disabled built-in data sources
    custom: DataSourceTemplate[]; // User-added data sources
  };
}

export interface RegoLabSettings {
  editor: EditorSettings;
  linting: LintingSettings;
  templates: TemplateSettings;
}

export interface VersionInfo {
  current: string;
  latest: string | null;
  updateAvailable: boolean;
  releaseUrl: string | null;
  checkedAt: string | null;
}

// ============================================================================
// Defaults
// ============================================================================

export const DEFAULT_SETTINGS: RegoLabSettings = {
  editor: {
    fontSize: 14,
    lineWrap: true,
    autoFormat: false,
    autoSave: false,
    autoSaveDelay: 1000,
  },
  linting: {
    strictMode: false,
    directoryPackageMismatch: false,
    liveLinting: true,
  },
  templates: {
    inputTemplates: {
      disabledBuiltIn: [],
      custom: [],
    },
    dataSourceTemplates: {
      disabledBuiltIn: [],
      custom: [],
    },
  },
};

const STORAGE_KEY = "regolab-settings";
const VERSION_CACHE_KEY = "regolab-version-cache";
const CURRENT_VERSION = "2.1.0"; // Should match package.json

// ============================================================================
// Context
// ============================================================================

interface SettingsContextValue {
  settings: RegoLabSettings;
  updateSettings: (updates: Partial<RegoLabSettings>) => void;
  updateEditorSettings: (updates: Partial<EditorSettings>) => void;
  updateLintingSettings: (updates: Partial<LintingSettings>) => void;
  resetSettings: () => void;
  
  // Template management
  disableBuiltInInputTemplate: (id: string) => void;
  enableBuiltInInputTemplate: (id: string) => void;
  addCustomInputTemplate: (template: Omit<InputTemplate, "isBuiltIn">) => void;
  removeCustomInputTemplate: (id: string) => void;
  
  disableBuiltInDataSource: (id: string) => void;
  enableBuiltInDataSource: (id: string) => void;
  addCustomDataSource: (template: Omit<DataSourceTemplate, "isBuiltIn">) => void;
  removeCustomDataSource: (id: string) => void;
  
  // Version checking
  versionInfo: VersionInfo;
  checkForUpdates: () => Promise<void>;
  isCheckingUpdates: boolean;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

// ============================================================================
// Provider
// ============================================================================

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<RegoLabSettings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);
  const [versionInfo, setVersionInfo] = useState<VersionInfo>({
    current: CURRENT_VERSION,
    latest: null,
    updateAvailable: false,
    releaseUrl: null,
    checkedAt: null,
  });

  // Load settings from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<RegoLabSettings>;
        // Deep merge with defaults to handle new settings added in updates
        setSettings(deepMerge(DEFAULT_SETTINGS, parsed));
      }
      
      // Load cached version info
      const versionCache = localStorage.getItem(VERSION_CACHE_KEY);
      if (versionCache) {
        const parsed = JSON.parse(versionCache);
        setVersionInfo({ ...parsed, current: CURRENT_VERSION });
      }
    } catch (e) {
      console.error("Failed to load settings:", e);
    }
    setIsLoaded(true);
  }, []);

  // Save settings to localStorage when they change
  useEffect(() => {
    if (!isLoaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
      console.error("Failed to save settings:", e);
    }
  }, [settings, isLoaded]);

  // Save version info to cache
  useEffect(() => {
    if (!isLoaded) return;
    try {
      localStorage.setItem(VERSION_CACHE_KEY, JSON.stringify(versionInfo));
    } catch (e) {
      console.error("Failed to save version cache:", e);
    }
  }, [versionInfo, isLoaded]);

  const updateSettings = useCallback((updates: Partial<RegoLabSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  }, []);

  const updateEditorSettings = useCallback((updates: Partial<EditorSettings>) => {
    setSettings(prev => ({
      ...prev,
      editor: { ...prev.editor, ...updates },
    }));
  }, []);

  const updateLintingSettings = useCallback((updates: Partial<LintingSettings>) => {
    setSettings(prev => ({
      ...prev,
      linting: { ...prev.linting, ...updates },
    }));
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
  }, []);

  // Template management functions
  const disableBuiltInInputTemplate = useCallback((id: string) => {
    setSettings(prev => ({
      ...prev,
      templates: {
        ...prev.templates,
        inputTemplates: {
          ...prev.templates.inputTemplates,
          disabledBuiltIn: [...new Set([...prev.templates.inputTemplates.disabledBuiltIn, id])],
        },
      },
    }));
  }, []);

  const enableBuiltInInputTemplate = useCallback((id: string) => {
    setSettings(prev => ({
      ...prev,
      templates: {
        ...prev.templates,
        inputTemplates: {
          ...prev.templates.inputTemplates,
          disabledBuiltIn: prev.templates.inputTemplates.disabledBuiltIn.filter(i => i !== id),
        },
      },
    }));
  }, []);

  const addCustomInputTemplate = useCallback((template: Omit<InputTemplate, "isBuiltIn">) => {
    setSettings(prev => ({
      ...prev,
      templates: {
        ...prev.templates,
        inputTemplates: {
          ...prev.templates.inputTemplates,
          custom: [...prev.templates.inputTemplates.custom, { ...template, isBuiltIn: false }],
        },
      },
    }));
  }, []);

  const removeCustomInputTemplate = useCallback((id: string) => {
    setSettings(prev => ({
      ...prev,
      templates: {
        ...prev.templates,
        inputTemplates: {
          ...prev.templates.inputTemplates,
          custom: prev.templates.inputTemplates.custom.filter(t => t.id !== id),
        },
      },
    }));
  }, []);

  const disableBuiltInDataSource = useCallback((id: string) => {
    setSettings(prev => ({
      ...prev,
      templates: {
        ...prev.templates,
        dataSourceTemplates: {
          ...prev.templates.dataSourceTemplates,
          disabledBuiltIn: [...new Set([...prev.templates.dataSourceTemplates.disabledBuiltIn, id])],
        },
      },
    }));
  }, []);

  const enableBuiltInDataSource = useCallback((id: string) => {
    setSettings(prev => ({
      ...prev,
      templates: {
        ...prev.templates,
        dataSourceTemplates: {
          ...prev.templates.dataSourceTemplates,
          disabledBuiltIn: prev.templates.dataSourceTemplates.disabledBuiltIn.filter(i => i !== id),
        },
      },
    }));
  }, []);

  const addCustomDataSource = useCallback((template: Omit<DataSourceTemplate, "isBuiltIn">) => {
    setSettings(prev => ({
      ...prev,
      templates: {
        ...prev.templates,
        dataSourceTemplates: {
          ...prev.templates.dataSourceTemplates,
          custom: [...prev.templates.dataSourceTemplates.custom, { ...template, isBuiltIn: false }],
        },
      },
    }));
  }, []);

  const removeCustomDataSource = useCallback((id: string) => {
    setSettings(prev => ({
      ...prev,
      templates: {
        ...prev.templates,
        dataSourceTemplates: {
          ...prev.templates.dataSourceTemplates,
          custom: prev.templates.dataSourceTemplates.custom.filter(t => t.id !== id),
        },
      },
    }));
  }, []);

  // Version checking
  const checkForUpdates = useCallback(async () => {
    setIsCheckingUpdates(true);
    try {
      const { API_ENDPOINTS } = await import('@/lib/api-config');
      const res = await fetch(API_ENDPOINTS.versionCheck);
      if (!res.ok) throw new Error("Failed to check for updates");
      const data = await res.json();
      
      setVersionInfo({
        current: CURRENT_VERSION,
        latest: data.latest,
        updateAvailable: data.updateAvailable,
        releaseUrl: data.releaseUrl,
        checkedAt: new Date().toISOString(),
      });
    } catch (e) {
      console.error("Failed to check for updates:", e);
    } finally {
      setIsCheckingUpdates(false);
    }
  }, []);

  const value = useMemo(() => ({
    settings,
    updateSettings,
    updateEditorSettings,
    updateLintingSettings,
    resetSettings,
    disableBuiltInInputTemplate,
    enableBuiltInInputTemplate,
    addCustomInputTemplate,
    removeCustomInputTemplate,
    disableBuiltInDataSource,
    enableBuiltInDataSource,
    addCustomDataSource,
    removeCustomDataSource,
    versionInfo,
    checkForUpdates,
    isCheckingUpdates,
  }), [
    settings,
    updateSettings,
    updateEditorSettings,
    updateLintingSettings,
    resetSettings,
    disableBuiltInInputTemplate,
    enableBuiltInInputTemplate,
    addCustomInputTemplate,
    removeCustomInputTemplate,
    disableBuiltInDataSource,
    enableBuiltInDataSource,
    addCustomDataSource,
    removeCustomDataSource,
    versionInfo,
    checkForUpdates,
    isCheckingUpdates,
  ]);

  // Don't render children until settings are loaded to prevent flash
  if (!isLoaded) {
    return null;
  }

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}

// ============================================================================
// Utilities
// ============================================================================

function deepMerge(target: RegoLabSettings, source: Partial<RegoLabSettings>): RegoLabSettings {
  return {
    editor: { ...target.editor, ...source.editor },
    linting: { ...target.linting, ...source.linting },
    templates: {
      inputTemplates: {
        disabledBuiltIn: source.templates?.inputTemplates?.disabledBuiltIn ?? target.templates.inputTemplates.disabledBuiltIn,
        custom: source.templates?.inputTemplates?.custom ?? target.templates.inputTemplates.custom,
      },
      dataSourceTemplates: {
        disabledBuiltIn: source.templates?.dataSourceTemplates?.disabledBuiltIn ?? target.templates.dataSourceTemplates.disabledBuiltIn,
        custom: source.templates?.dataSourceTemplates?.custom ?? target.templates.dataSourceTemplates.custom,
      },
    },
  };
}
