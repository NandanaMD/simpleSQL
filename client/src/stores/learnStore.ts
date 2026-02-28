import { create } from 'zustand';

const LEARN_MODE_KEY = 'sqlide-learn-mode-enabled';

function loadLearnMode(): boolean {
  try {
    return localStorage.getItem(LEARN_MODE_KEY) === 'true';
  } catch {
    return false;
  }
}

function saveLearnMode(value: boolean): void {
  try {
    localStorage.setItem(LEARN_MODE_KEY, String(value));
  } catch {
    // Ignore storage write issues
  }
}

interface LearnStore {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  toggle: () => void;
}

export const useLearnStore = create<LearnStore>()((set) => ({
  enabled: loadLearnMode(),
  setEnabled: (enabled: boolean) => {
    saveLearnMode(enabled);
    set({ enabled });
  },
  toggle: () => set((state) => {
    const next = !state.enabled;
    saveLearnMode(next);
    return { enabled: next };
  }),
}));
