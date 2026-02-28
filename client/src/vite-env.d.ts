/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  electron?: {
    platform: string;
    apiAuthToken?: string;
    checkForUpdates?: () => Promise<{ ok: boolean; message?: string }>;
    onUpdateStatus?: (
      callback: (event: {
        status: 'available' | 'downloading' | 'downloaded' | 'error' | string;
        version?: string;
        percent?: number;
        message?: string;
      }) => void
    ) => () => void;
  };
}
