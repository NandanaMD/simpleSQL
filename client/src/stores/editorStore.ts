import { create } from 'zustand';
import type { EditorTab, QueryResult, QueryHistory } from '@sql-ide/shared';

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
function loadTabsFromStorage(): EditorTab[] {
  try {
    const stored = localStorage.getItem('sqlide-editor-tabs');
    if (!stored) return [];
    
    const tabs = JSON.parse(stored);
    // Restore tabs but clear runtime-only data (results, decorations)
    return tabs.map((tab: EditorTab) => ({
      ...tab,
      mode: tab.mode || 'sql', // Default to SQL mode if not set
      resultRows: undefined,
      resultColumns: undefined,
      resultCommand: undefined,
      resultRowCount: undefined,
      executionTime: undefined,
      executionTimestamp: undefined,
      errorInfo: null,
      decorations: undefined,
      translatedSql: undefined, // Don't restore ephemeral translated SQL
      isDirty: false, // Reset dirty flag on reload
    }));
  } catch (error) {
    console.error('Failed to load editor tabs', error);
    return [];
  }
}

function loadActiveTabIdFromStorage(): string | null {
  try {
    const stored = localStorage.getItem('sqlide-active-tab-id');
    return stored || null;
  } catch {
    return null;
  }
}

function saveTabsToStorage(tabs: EditorTab[], activeTabId: string | null): void {
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
    
    localStorage.setItem('sqlide-editor-tabs', JSON.stringify(tabsToSave));
    if (activeTabId) {
      saveActiveTabIdToStorage(activeTabId);
    }
  } catch (error){
    console.error('Failed to save editor tabs', error);
  }
}

function saveActiveTabIdToStorage(tabId: string): void {
  try {
    localStorage.setItem('sqlide-active-tab-id', tabId);
  } catch (error) {
    console.error('Failed to save active tab ID', error);
  }
}

interface EditorStore {
  tabs: EditorTab[];
  activeTabId: string | null;
  queryError: string | null;
  isExecuting: boolean;
  queryHistory: QueryHistory[];

  createTab: (connectionId?: string, database?: string) => string;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  updateTabContent: (id: string, content: string) => void;
  updateTabTitle: (id: string, title: string) => void;
  setTabConnection: (id: string, connectionId: string, database: string) => void;
  setTabMode: (id: string, mode: 'sql' | 'simple') => void;
  setTabTranslatedSql: (id: string, translatedSql: string | undefined) => void;
  setTabResult: (id: string, result: QueryResult) => void;
  setTabError: (id: string, error: string | null) => void;
  setTabDecorations: (id: string, decorations: string[]) => void;
  clearTabResult: (id: string) => void;
  setQueryError: (error: string | null) => void;
  setIsExecuting: (isExecuting: boolean) => void;
  addToHistory: (history: QueryHistory) => void;
  clearHistory: () => void;
}

export const useEditorStore = create<EditorStore>()((set, get) => ({
  tabs: loadTabsFromStorage(),
  activeTabId: loadActiveTabIdFromStorage(),
  queryError: null,
  isExecuting: false,
  queryHistory: loadHistoryFromStorage(),

  createTab: (connectionId?: string, database?: string) => {
    const id = nanoid();
    const newTab: EditorTab = {
      id,
      title: `Query ${get().tabs.length + 1}`,
      content: '',
      isDirty: false,
      mode: 'sql', // Default mode
      connectionId,
      database,
    };

    set((state) => {
      const newState = {
        tabs: [...state.tabs, newTab],
        activeTabId: id,
      };
      saveTabsToStorage(newState.tabs, id);
      return newState;
    });

    return id;
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

      saveTabsToStorage(remainingTabs, newActiveTabId);
      return {
        tabs: remainingTabs,
        activeTabId: newActiveTabId,
      };
    });
  },

  setActiveTab: (id: string) => {
    set({ activeTabId: id });
    saveActiveTabIdToStorage(id);
  },

  updateTabContent: (id: string, content: string) => {
    set((state) => {
      const newTabs = state.tabs.map((tab) =>
        tab.id === id ? { ...tab, content, isDirty: true } : tab
      );
      saveTabsToStorage(newTabs, state.activeTabId);
      return { tabs: newTabs };
    });
  },

  updateTabTitle: (id: string, title: string) => {
    set((state) => {
      const newTabs = state.tabs.map((tab) => (tab.id === id ? { ...tab, title } : tab));
      saveTabsToStorage(newTabs, state.activeTabId);
      return { tabs: newTabs };
    });
  },

  setTabConnection: (id: string, connectionId: string, database: string) => {
    set((state) => {
      const newTabs = state.tabs.map((tab) =>
        tab.id === id ? { ...tab, connectionId, database } : tab
      );
      saveTabsToStorage(newTabs, state.activeTabId);
      return { tabs: newTabs };
    });
  },

  setTabMode: (id: string, mode: 'sql' | 'simple') => {
    set((state) => {
      const newTabs = state.tabs.map((tab) =>
        tab.id === id ? { ...tab, mode, translatedSql: undefined } : tab
      );
      saveTabsToStorage(newTabs, state.activeTabId);
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

  setTabResult: (id: string, result: QueryResult) => {
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
              errorInfo: null,
            }
          : tab
      );
      // Don't persist large result sets to localStorage - only persist query content
      saveTabsToStorage(newTabs, state.activeTabId);
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
            }
          : tab
      );
      saveTabsToStorage(newTabs, state.activeTabId);
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