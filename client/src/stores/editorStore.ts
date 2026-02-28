import { create } from 'zustand';
import type { EditorTab, QueryResult, QueryHistory } from '@sql-ide/shared';

const LEGACY_TABS_KEY = 'sqlide-editor-tabs';
const LEGACY_ACTIVE_TAB_KEY = 'sqlide-active-tab-id';

function getTabsStorageKey(connectionId: string): string {
  return `sqlide-editor-tabs:${connectionId}`;
}

function getActiveTabStorageKey(connectionId: string): string {
  return `sqlide-active-tab-id:${connectionId}`;
}

// Simple nanoid implementation
function nanoid() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Storage helper functions - must be declared before store creation
function loadHistoryFromStorage(): QueryHistory[] {
  try {
    const stored = localStorage.getItem('sqlide-query-history');
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveHistoryToStorage(history: QueryHistory[]): void {
  try {
    localStorage.setItem('sqlide-query-history', JSON.stringify(history));
  } catch (error) {
    console.error('Failed to save query history', error);
  }
}

// Tab persistence functions
function sanitizeLoadedTabs(tabs: EditorTab[]): EditorTab[] {
  return tabs.map((tab: EditorTab) => ({
    ...tab,
    mode: tab.mode || 'sql', // Default to SQL mode if not set
    resultRows: undefined,
    resultColumns: undefined,
    resultCommand: undefined,
    resultRowCount: undefined,
    executionTime: undefined,
    executionTimestamp: undefined,
    lastExecutedSql: undefined,
    lastExecutionMode: undefined,
    lastExecutionConnectionId: undefined,
    lastExecutionDatabase: undefined,
    errorInfo: null,
    decorations: undefined,
    translatedSql: undefined, // Don't restore ephemeral translated SQL
    isDirty: false, // Reset dirty flag on reload
  }));
}

function loadTabsFromStorage(connectionId: string): EditorTab[] {
  try {
    const scopedStored = localStorage.getItem(getTabsStorageKey(connectionId));
    if (scopedStored) {
      const scopedTabs = JSON.parse(scopedStored) as EditorTab[];
      return sanitizeLoadedTabs(scopedTabs);
    }

    const legacyStored = localStorage.getItem(LEGACY_TABS_KEY);
    if (!legacyStored) return [];

    const legacyTabs = JSON.parse(legacyStored) as EditorTab[];
    const migratedTabs = sanitizeLoadedTabs(legacyTabs).map((tab) => ({
      ...tab,
      connectionId: tab.connectionId || connectionId,
    }));

    saveTabsToStorage(connectionId, migratedTabs, null);
    return migratedTabs;
  } catch (error) {
    console.error('Failed to load editor tabs', error);
    return [];
  }
}

function loadActiveTabIdFromStorage(connectionId: string): string | null {
  try {
    const scopedStored = localStorage.getItem(getActiveTabStorageKey(connectionId));
    if (scopedStored) {
      return scopedStored;
    }

    const legacyStored = localStorage.getItem(LEGACY_ACTIVE_TAB_KEY);
    return legacyStored || null;
  } catch {
    return null;
  }
}

function saveTabsToStorage(connectionId: string, tabs: EditorTab[], activeTabId: string | null): void {
  try {
    // Only persist essential tab data (not large result sets)
    const tabsToSave = tabs.map((tab) => ({
      id: tab.id,
      title: tab.title,
      content: tab.content,
      isDirty: tab.isDirty,
      mode: tab.mode || 'sql',
      connectionId: tab.connectionId,
      database: tab.database,
      // Don't save: resultRows, resultColumns, decorations, translatedSql (too large / not serializable / ephemeral)
    }));

    localStorage.setItem(getTabsStorageKey(connectionId), JSON.stringify(tabsToSave));
    if (activeTabId) {
      saveActiveTabIdToStorage(connectionId, activeTabId);
    }
  } catch (error){
    console.error('Failed to save editor tabs', error);
  }
}

function saveActiveTabIdToStorage(connectionId: string, tabId: string): void {
  try {
    localStorage.setItem(getActiveTabStorageKey(connectionId), tabId);
  } catch (error) {
    console.error('Failed to save active tab ID', error);
  }
}

function createDefaultTab(connectionId: string, database?: string): EditorTab {
  return {
    id: nanoid(),
    title: 'Query 1',
    content: '',
    isDirty: false,
    mode: 'sql',
    connectionId,
    database,
    errorInfo: null,
    translatedSql: undefined,
    decorations: undefined,
    resultRows: undefined,
    resultColumns: undefined,
    resultCommand: undefined,
    resultRowCount: undefined,
    executionTime: undefined,
    executionTimestamp: undefined,
    lastExecutedSql: undefined,
    lastExecutionMode: undefined,
    lastExecutionConnectionId: undefined,
    lastExecutionDatabase: undefined,
  };
}

interface EditorStore {
  tabs: EditorTab[];
  activeTabId: string | null;
  activeConnectionId: string | null;
  queryError: string | null;
  isExecuting: boolean;
  queryHistory: QueryHistory[];

  createTab: (connectionId?: string, database?: string) => string;
  loadTabsForConnection: (connectionId: string, database?: string) => void;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  updateTabContent: (id: string, content: string) => void;
  updateTabTitle: (id: string, title: string) => void;
  setTabConnection: (id: string, connectionId: string, database: string) => void;
  setTabMode: (id: string, mode: 'sql' | 'simple') => void;
  setTabTranslatedSql: (id: string, translatedSql: string | undefined) => void;
  setTabResult: (
    id: string,
    result: QueryResult,
    executionMeta?: {
      sql: string;
      mode: 'sql' | 'simple';
      connectionId: string;
      database?: string;
    }
  ) => void;
  setTabError: (id: string, error: string | null) => void;
  setTabDecorations: (id: string, decorations: string[]) => void;
  clearTabResult: (id: string) => void;
  setQueryError: (error: string | null) => void;
  setIsExecuting: (isExecuting: boolean) => void;
  addToHistory: (history: QueryHistory) => void;
  clearHistory: () => void;
}

export const useEditorStore = create<EditorStore>()((set, get) => ({
  tabs: [],
  activeTabId: null,
  activeConnectionId: null,
  queryError: null,
  isExecuting: false,
  queryHistory: loadHistoryFromStorage(),

  createTab: (connectionId?: string, database?: string) => {
    const targetConnectionId = connectionId || get().activeConnectionId || undefined;
    const id = nanoid();
    const newTab: EditorTab = {
      id,
      title: `Query ${get().tabs.length + 1}`,
      content: '',
      isDirty: false,
      mode: 'sql', // Default mode
      connectionId: targetConnectionId,
      database,
    };

    set((state) => {
      const newState = {
        tabs: [...state.tabs, newTab],
        activeTabId: id,
      };
      if (state.activeConnectionId) {
        saveTabsToStorage(state.activeConnectionId, newState.tabs, id);
      }
      return newState;
    });

    return id;
  },

  loadTabsForConnection: (connectionId: string, database?: string) => {
    const loadedTabs = loadTabsFromStorage(connectionId);
    const loadedActiveTabId = loadActiveTabIdFromStorage(connectionId);
    const hasLoadedTabs = loadedTabs.length > 0;

    const tabs = hasLoadedTabs
      ? loadedTabs.map((tab) => ({ ...tab, connectionId: tab.connectionId || connectionId }))
      : [createDefaultTab(connectionId, database)];

    const activeTabId = tabs.some((tab) => tab.id === loadedActiveTabId)
      ? loadedActiveTabId
      : tabs[0].id;

    saveTabsToStorage(connectionId, tabs, activeTabId);

    set({
      tabs,
      activeTabId,
      activeConnectionId: connectionId,
      queryError: null,
      isExecuting: false,
    });
  },

  closeTab: (id: string) => {
    set((state) => {
      const remainingTabs = state.tabs.filter((tab) => tab.id !== id);
      let newActiveTabId = state.activeTabId;

      if (state.activeTabId === id && remainingTabs.length > 0) {
        const closedIndex = state.tabs.findIndex((tab) => tab.id === id);
        const newIndex = Math.min(closedIndex, remainingTabs.length - 1);
        newActiveTabId = remainingTabs[newIndex].id;
      } else if (remainingTabs.length === 0) {
        newActiveTabId = null;
      }

      if (state.activeConnectionId) {
        saveTabsToStorage(state.activeConnectionId, remainingTabs, newActiveTabId);
      }
      return {
        tabs: remainingTabs,
        activeTabId: newActiveTabId,
      };
    });
  },

  setActiveTab: (id: string) => {
    set((state) => {
      if (state.activeConnectionId) {
        saveActiveTabIdToStorage(state.activeConnectionId, id);
      }
      return { activeTabId: id };
    });
  },

  updateTabContent: (id: string, content: string) => {
    set((state) => {
      const newTabs = state.tabs.map((tab) =>
        tab.id === id ? { ...tab, content, isDirty: true } : tab
      );
      if (state.activeConnectionId) {
        saveTabsToStorage(state.activeConnectionId, newTabs, state.activeTabId);
      }
      return { tabs: newTabs };
    });
  },

  updateTabTitle: (id: string, title: string) => {
    set((state) => {
      const newTabs = state.tabs.map((tab) => (tab.id === id ? { ...tab, title } : tab));
      if (state.activeConnectionId) {
        saveTabsToStorage(state.activeConnectionId, newTabs, state.activeTabId);
      }
      return { tabs: newTabs };
    });
  },

  setTabConnection: (id: string, connectionId: string, database: string) => {
    set((state) => {
      const newTabs = state.tabs.map((tab) =>
        tab.id === id ? { ...tab, connectionId, database } : tab
      );
      if (state.activeConnectionId) {
        saveTabsToStorage(state.activeConnectionId, newTabs, state.activeTabId);
      }
      return { tabs: newTabs };
    });
  },

  setTabMode: (id: string, mode: 'sql' | 'simple') => {
    set((state) => {
      const newTabs = state.tabs.map((tab) =>
        tab.id === id ? { ...tab, mode, translatedSql: undefined } : tab
      );
      if (state.activeConnectionId) {
        saveTabsToStorage(state.activeConnectionId, newTabs, state.activeTabId);
      }
      return { tabs: newTabs };
    });
  },

  setTabTranslatedSql: (id: string, translatedSql: string | undefined) => {
    set((state) => {
      const newTabs = state.tabs.map((tab) =>
        tab.id === id ? { ...tab, translatedSql } : tab
      );
      // Don't persist translatedSql to localStorage - it's ephemeral
      return { tabs: newTabs };
    });
  },

  setTabResult: (id: string, result: QueryResult, executionMeta) => {
    set((state) => {
      const newTabs = state.tabs.map((tab) =>
        tab.id === id
          ? {
              ...tab,
              resultRows: result.rows,
              resultColumns: result.fields,
              resultCommand: result.command,
              resultRowCount: result.rowCount,
              executionTime: result.executionTime,
              executionTimestamp: new Date(),
              lastExecutedSql: executionMeta?.sql,
              lastExecutionMode: executionMeta?.mode,
              lastExecutionConnectionId: executionMeta?.connectionId,
              lastExecutionDatabase: executionMeta?.database,
              errorInfo: null,
            }
          : tab
      );
      // Don't persist large result sets to localStorage - only persist query content
      if (state.activeConnectionId) {
        saveTabsToStorage(state.activeConnectionId, newTabs, state.activeTabId);
      }
      return {
        tabs: newTabs,
        queryError: null,
      };
    });
  },

  setTabError: (id: string, error: string | null) => {
    set((state) => {
      const newTabs = state.tabs.map((tab) =>
        tab.id === id
          ? {
              ...tab,
              errorInfo: error,
              resultRows: undefined,
              resultColumns: undefined,
              resultCommand: undefined,
              resultRowCount: undefined,
              executionTime: undefined,
              executionTimestamp: undefined,
              lastExecutedSql: undefined,
              lastExecutionMode: undefined,
              lastExecutionConnectionId: undefined,
              lastExecutionDatabase: undefined,
            }
          : tab
      );
      if (state.activeConnectionId) {
        saveTabsToStorage(state.activeConnectionId, newTabs, state.activeTabId);
      }
      return { tabs: newTabs };
    });
  },

  setTabDecorations: (id: string, decorations: string[]) => {
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === id ? { ...tab, decorations } : tab
      ),
    }));
  },

  clearTabResult: (id: string) => {
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === id
          ? {
              ...tab,
              resultRows: undefined,
              resultColumns: undefined,
              resultCommand: undefined,
              resultRowCount: undefined,
              executionTime: undefined,
              executionTimestamp: undefined,
              lastExecutedSql: undefined,
              lastExecutionMode: undefined,
              lastExecutionConnectionId: undefined,
              lastExecutionDatabase: undefined,
              errorInfo: null,
              decorations: undefined,
            }
          : tab
      ),
    }));
  },

  setQueryError: (error: string | null) => {
    set({ queryError: error });
  },

  setIsExecuting: (isExecuting: boolean) => {
    set({ isExecuting });
  },

  addToHistory: (history: QueryHistory) => {
    set((state) => {
      const newHistory = [history, ...state.queryHistory].slice(0, 100);
      saveHistoryToStorage(newHistory);
      return { queryHistory: newHistory };
    });
  },

  clearHistory: () => {
    set({ queryHistory: [] });
    localStorage.removeItem('sqlide-query-history');
  },
}));