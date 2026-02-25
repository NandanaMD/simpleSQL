import { create } from 'zustand';
import type { EditorTab, QueryResult, QueryHistory } from '@sql-ide/shared';

// Simple nanoid implementation
function nanoid() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

interface ResultTab {
  id: string;
  label: string;
  result: QueryResult;
  timestamp: Date;
}

interface EditorStore {
  tabs: EditorTab[];
  activeTabId: string | null;
  resultTabs: ResultTab[];
  activeResultTabId: string | null;
  queryError: string | null;
  isExecuting: boolean;
  queryHistory: QueryHistory[];

  createTab: (connectionId?: string, database?: string) => string;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  updateTabContent: (id: string, content: string) => void;
  updateTabTitle: (id: string, title: string) => void;
  setTabConnection: (id: string, connectionId: string, database: string) => void;
  addResultTab: (result: QueryResult) => void;
  closeResultTab: (id: string) => void;
  setActiveResultTab: (id: string) => void;
  clearAllResultTabs: () => void;
  setQueryError: (error: string | null) => void;
  setIsExecuting: (isExecuting: boolean) => void;
  addToHistory: (history: QueryHistory) => void;
  clearHistory: () => void;
}

export const useEditorStore = create<EditorStore>()((set, get) => ({
  tabs: [],
  activeTabId: null,
  resultTabs: [],
  activeResultTabId: null,
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
      connectionId,
      database,
    };

    set((state) => ({
      tabs: [...state.tabs, newTab],
      activeTabId: id,
    }));

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

      return {
        tabs: remainingTabs,
        activeTabId: newActiveTabId,
      };
    });
  },

  setActiveTab: (id: string) => {
    set({ activeTabId: id });
  },

  updateTabContent: (id: string, content: string) => {
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === id ? { ...tab, content, isDirty: true } : tab
      ),
    }));
  },

  updateTabTitle: (id: string, title: string) => {
    set((state) => ({
      tabs: state.tabs.map((tab) => (tab.id === id ? { ...tab, title } : tab)),
    }));
  },

  setTabConnection: (id: string, connectionId: string, database: string) => {
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === id ? { ...tab, connectionId, database } : tab
      ),
    }));
  },

  addResultTab: (result: QueryResult) => {
    const id = nanoid();
    const resultTabCount = get().resultTabs.length;
    const newResultTab: ResultTab = {
      id,
      label: `Result ${resultTabCount + 1}`,
      result,
      timestamp: new Date(),
    };

    set((state) => ({
      resultTabs: [...state.resultTabs, newResultTab],
      activeResultTabId: id,
      queryError: null,
    }));
  },

  closeResultTab: (id: string) => {
    set((state) => {
      const remainingTabs = state.resultTabs.filter((tab) => tab.id !== id);
      let newActiveId = state.activeResultTabId;

      if (state.activeResultTabId === id && remainingTabs.length > 0) {
        const closedIndex = state.resultTabs.findIndex((tab) => tab.id === id);
        const newIndex = Math.min(closedIndex, remainingTabs.length - 1);
        newActiveId = remainingTabs[newIndex].id;
      } else if (remainingTabs.length === 0) {
        newActiveId = null;
      }

      return {
        resultTabs: remainingTabs,
        activeResultTabId: newActiveId,
      };
    });
  },

  setActiveResultTab: (id: string) => {
    set({ activeResultTabId: id });
  },

  clearAllResultTabs: () => {
    set({ resultTabs: [], activeResultTabId: null });
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
