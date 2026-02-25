import { create } from 'zustand';

type Theme = 'light' | 'dark';

interface ThemeStore {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

// Initialize theme from localStorage
const getInitialTheme = (): Theme => {
  if (typeof window === 'undefined') return 'light';
  const stored = localStorage.getItem('sql-ide-theme');
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      return parsed.state?.theme || 'light';
    } catch {
      return 'light';
    }
  }
  return 'light';
};

export const useThemeStore = create<ThemeStore>()((set) => {
  const initialTheme = getInitialTheme();
  
  // Apply initial theme
  if (initialTheme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }

  return {
    theme: initialTheme,
    toggleTheme: () =>
      set((state) => {
        const newTheme = state.theme === 'light' ? 'dark' : 'light';
        // Apply theme to document
        if (newTheme === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
        // Save to localStorage
        localStorage.setItem('sql-ide-theme', JSON.stringify({ state: { theme: newTheme } }));
        return { theme: newTheme };
      }),
    setTheme: (theme) => {
      set({ theme });
      // Apply theme to document
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      // Save to localStorage
      localStorage.setItem('sql-ide-theme', JSON.stringify({ state: { theme } }));
    },
  };
});
