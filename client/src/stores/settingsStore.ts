import { create } from 'zustand';

export interface EditorSettings {
  fontSize: number;
  tabSize: number;
  fontFamily: string;
  minimap: boolean;
  lineNumbers: boolean;
  wordWrap: boolean;
}

export interface QuerySettings {
  timeout: number; // milliseconds
  maxRows: number;
  fetchSize: number;
  autoSave: boolean;
  autoSaveInterval: number; // seconds
  confirmDelete: boolean;
  confirmDrop: boolean;
}

export interface FormatSettings {
  dateFormat: string;
  timeFormat: string;
  numberPrecision: number;
  nullDisplay: string;
  booleanDisplay: { true: string; false: string };
}

export interface ConnectionSettings {
  autoReconnect: boolean;
  reconnectAttempts: number;
  reconnectDelay: number; // milliseconds
  connectionTimeout: number; // seconds
  lastUsedConnectionId: string | null;
}

interface SettingsStore {
  editor: EditorSettings;
  query: QuerySettings;
  format: FormatSettings;
  connection: ConnectionSettings;
  
  updateEditorSettings: (settings: Partial<EditorSettings>) => void;
  updateQuerySettings: (settings: Partial<QuerySettings>) => void;
  updateFormatSettings: (settings: Partial<FormatSettings>) => void;
  updateConnectionSettings: (settings: Partial<ConnectionSettings>) => void;
  resetToDefaults: () => void;
}

const defaultSettings = {
  editor: {
    fontSize: 14,
    tabSize: 2,
    fontFamily: 'Monaco, Menlo, "Courier New", monospace',
    minimap: true,
    lineNumbers: true,
    wordWrap: false,
  },
  query: {
    timeout: 30000, // 30 seconds
    maxRows: 1000,
    fetchSize: 100,
    autoSave: true,
    autoSaveInterval: 30, // 30 seconds
    confirmDelete: true,
    confirmDrop: true,
  },
  format: {
    dateFormat: 'YYYY-MM-DD',
    timeFormat: 'HH:mm:ss',
    numberPrecision: 2,
    nullDisplay: 'NULL',
    booleanDisplay: { true: 'true', false: 'false' },
  },
  connection: {
    autoReconnect: true,
    reconnectAttempts: 3,
    reconnectDelay: 2000, // 2 seconds
    connectionTimeout: 10, // 10 seconds
    lastUsedConnectionId: null,
  },
};

// Initialize from localStorage
const getStoredSettings = () => {
  if (typeof window === 'undefined') return defaultSettings;
  const stored = localStorage.getItem('sql-ide-settings');
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      return { ...defaultSettings, ...parsed.state };
    } catch {
      return defaultSettings;
    }
  }
  return defaultSettings;
};

export const useSettingsStore = create<SettingsStore>()((set) => {
  const initial = getStoredSettings();
  
  const saveToStorage = (state: any) => {
    localStorage.setItem('sql-ide-settings', JSON.stringify({ state }));
  };

  return {
    ...initial,

    updateEditorSettings: (settings) =>
      set((state) => {
        const newState = {
          editor: { ...state.editor, ...settings },
        };
        saveToStorage({ ...state, ...newState });
        return newState;
      }),

    updateQuerySettings: (settings) =>
      set((state) => {
        const newState = {
          query: { ...state.query, ...settings },
        };
        saveToStorage({ ...state, ...newState });
        return newState;
      }),

    updateFormatSettings: (settings) =>
      set((state) => {
        const newState = {
          format: { ...state.format, ...settings },
        };
        saveToStorage({ ...state, ...newState });
        return newState;
      }),

    updateConnectionSettings: (settings) =>
      set((state) => {
        const newState = {
          connection: { ...state.connection, ...settings },
        };
        saveToStorage({ ...state, ...newState });
        return newState;
      }),

    resetToDefaults: () => {
      saveToStorage(defaultSettings);
      return set(defaultSettings);
    },
  };
});
