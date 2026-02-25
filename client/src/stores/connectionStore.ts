import { create } from 'zustand';
import type { Connection } from '@sql-ide/shared';
import * as api from '../lib/api';

interface ConnectionStore {
  connections: Connection[];
  selectedConnectionId: string | null;
  selectedDatabase: string | null;
  loading: boolean;
  error: string | null;

  fetchConnections: () => Promise<void>;
  selectConnection: (id: string | null) => void;
  selectDatabase: (database: string | null) => void;
  setActiveConnection: (connectionId: string, database: string) => void;
  addConnection: (connection: Connection) => void;
  removeConnection: (id: string) => void;
  updateConnection: (id: string, connection: Connection) => void;
}

export const useConnectionStore = create<ConnectionStore>()((set) => ({
  connections: [],
  selectedConnectionId: null,
  selectedDatabase: null,
  loading: false,
  error: null,

  fetchConnections: async () => {
    set({ loading: true, error: null });
    try {
      const connections = await api.getAllConnections();
      set({ connections, loading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch connections',
        loading: false,
      });
    }
  },

  selectConnection: (id: string | null) => {
    set({ selectedConnectionId: id });
  },

  selectDatabase: (database: string | null) => {
    set({ selectedDatabase: database });
  },

  setActiveConnection: (connectionId: string, database: string) => {
    set({ selectedConnectionId: connectionId, selectedDatabase: database });
  },

  addConnection: (connection: Connection) => {
    set((state) => ({
      connections: [...state.connections, connection],
    }));
  },

  removeConnection: (id: string) => {
    set((state) => ({
      connections: state.connections.filter((c) => c.id !== id),
      selectedConnectionId: state.selectedConnectionId === id ? null : state.selectedConnectionId,
    }));
  },

  updateConnection: (id: string, connection: Connection) => {
    set((state) => ({
      connections: state.connections.map((c) => (c.id === id ? connection : c)),
    }));
  },
}));
