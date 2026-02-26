import { create } from 'zustand';
import { SavedQuery } from '../lib/api';

interface SavedQueriesStore {
  savedQueries: SavedQuery[];
  selectedQueryId: string | null;
  searchTerm: string;
  selectedFolder: string | null;
  
  setSavedQueries: (queries: SavedQuery[]) => void;
  addSavedQuery: (query: SavedQuery) => void;
  updateSavedQueryInStore: (id: string, updates: Partial<SavedQuery>) => void;
  removeSavedQuery: (id: string) => void;
  setSelectedQueryId: (id: string | null) => void;
  setSearchTerm: (term: string) => void;
  setSelectedFolder: (folder: string | null) => void;
  
  // Computed getters
  getFilteredQueries: () => SavedQuery[];
  getFolders: () => string[];
}

export const useSavedQueriesStore = create<SavedQueriesStore>((set, get) => ({
  savedQueries: [],
  selectedQueryId: null,
  searchTerm: '',
  selectedFolder: null,
  
  setSavedQueries: (queries) => set({ savedQueries: queries }),
  
  addSavedQuery: (query) =>
    set((state) => ({
      savedQueries: [query, ...state.savedQueries],
    })),
  
  updateSavedQueryInStore: (id, updates) =>
    set((state) => ({
      savedQueries: state.savedQueries.map((q) =>
        q.id === id ? { ...q, ...updates, updatedAt: new Date().toISOString() } : q
      ),
    })),
  
  removeSavedQuery: (id) =>
    set((state) => ({
      savedQueries: state.savedQueries.filter((q) => q.id !== id),
      selectedQueryId: state.selectedQueryId === id ? null : state.selectedQueryId,
    })),
  
  setSelectedQueryId: (id) => set({ selectedQueryId: id }),
  setSearchTerm: (term) => set({ searchTerm: term }),
  setSelectedFolder: (folder) => set({ selectedFolder: folder }),
  
  getFilteredQueries: () => {
    const { savedQueries, searchTerm, selectedFolder } = get();
    
    return savedQueries.filter((query) => {
      // Filter by folder
      if (selectedFolder && query.folder !== selectedFolder) {
        return false;
      }
      
      // Filter by search term
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          query.name.toLowerCase().includes(term) ||
          query.description?.toLowerCase().includes(term) ||
          query.sql.toLowerCase().includes(term) ||
          query.tags?.some((tag) => tag.toLowerCase().includes(term))
        );
      }
      
      return true;
    });
  },
  
  getFolders: () => {
    const { savedQueries } = get();
    const folders = new Set<string>();
    savedQueries.forEach((query) => {
      if (query.folder) {
        folders.add(query.folder);
      }
    });
    return Array.from(folders).sort();
  },
}));
