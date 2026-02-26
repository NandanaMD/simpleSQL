import { create } from 'zustand';
import type { CSVPreview, ColumnMapping, CSVImportResult } from '@sql-ide/shared';

export interface BatchImportFileResult {
  fileName: string;
  tableName: string;
  success: boolean;
  rowsInserted: number;
  duration: number;
  errors: Array<{ row: number; message: string }>;
  message: string;
}

export interface ImportState {
  // Wizard state
  currentStep: number;
  isOpen: boolean;
  
  // Pre-selected context (from right-click)
  preselectedConnectionId?: string;
  preselectedDatabase?: string;
  preselectedSchema?: string;
  preselectedTable?: string;
  
  // Step 1: File
  file: File | null;
  files: File[];
  preview: CSVPreview | null;
  delimiter: string;
  hasHeader: boolean;
  encoding: string;
  
  // Step 2: Target
  connectionId: string;
  database: string;
  schema: string;
  tableName: string;
  importMode: 'create' | 'append' | 'replace';
  
  // Step 3: Column Mapping
  columnMappings: ColumnMapping[];
  
  // Step 4: Options
  batchSize: number;
  errorStrategy: 'stop' | 'skip' | 'continue';
  maxErrors: number;
  truncateTable: boolean;
  
  // Step 5: Progress
  isImporting: boolean;
  importProgress: number;
  importResult: CSVImportResult | null;
  batchImportResults: BatchImportFileResult[];
  
  // Actions
  openWizard: (context?: {
    connectionId?: string;
    database?: string;
    schema?: string;
    table?: string;
  }) => void;
  closeWizard: () => void;
  reset: () => void;
  setCurrentStep: (step: number) => void;
  nextStep: () => void;
  previousStep: () => void;
  
  // Step 1 actions
  setFile: (file: File | null) => void;
  setFiles: (files: File[]) => void;
  removeFileAt: (index: number) => void;
  setPreview: (preview: CSVPreview | null) => void;
  setDelimiter: (delimiter: string) => void;
  setHasHeader: (hasHeader: boolean) => void;
  setEncoding: (encoding: string) => void;
  
  // Step 2 actions
  setConnectionId: (id: string) => void;
  setDatabase: (database: string) => void;
  setSchema: (schema: string) => void;
  setTableName: (tableName: string) => void;
  setImportMode: (mode: 'create' | 'append' | 'replace') => void;
  
  // Step 3 actions
  setColumnMappings: (mappings: ColumnMapping[]) => void;
  updateColumnMapping: (index: number, mapping: Partial<ColumnMapping>) => void;
  
  // Step 4 actions
  setBatchSize: (size: number) => void;
  setErrorStrategy: (strategy: 'stop' | 'skip' | 'continue') => void;
  setMaxErrors: (max: number) => void;
  setTruncateTable: (truncate: boolean) => void;
  
  // Step 5 actions
  setIsImporting: (importing: boolean) => void;
  setImportProgress: (progress: number) => void;
  setImportResult: (result: CSVImportResult | null) => void;
  setBatchImportResults: (results: BatchImportFileResult[]) => void;
}

const initialState = {
  currentStep: 0,
  isOpen: false,
  file: null,
  files: [],
  preview: null,
  delimiter: ',',
  hasHeader: true,
  encoding: 'utf-8',
  connectionId: '',
  database: '',
  schema: 'main',
  tableName: '',
  importMode: 'create' as const,
  columnMappings: [],
  batchSize: 1000,
  errorStrategy: 'skip' as const,
  maxErrors: 100,
  truncateTable: false,
  isImporting: false,
  importProgress: 0,
  importResult: null,
  batchImportResults: [],
};

export const useImportStore = create<ImportState>((set) => ({
  ...initialState,
  
  openWizard: (context) => set({
    isOpen: true,
    currentStep: 0,
    preselectedConnectionId: context?.connectionId,
    preselectedDatabase: context?.database,
    preselectedSchema: context?.schema || 'main',
    preselectedTable: context?.table,
    connectionId: context?.connectionId || '',
    database: context?.database || '',
    schema: context?.schema || 'main',
    tableName: context?.table || '',
    importMode: context?.table ? 'append' : 'create',
  }),
  
  closeWizard: () => set({ isOpen: false }),
  
  reset: () => set(initialState),
  
  setCurrentStep: (step) => set({ currentStep: step }),
  
  nextStep: () => set((state) => ({ currentStep: Math.min(state.currentStep + 1, 4) })),
  
  previousStep: () => set((state) => ({ currentStep: Math.max(state.currentStep - 1, 0) })),
  
  setFile: (file) => set({ file, files: file ? [file] : [] }),
  setFiles: (files) => set({
    files,
    file: files[0] || null,
  }),
  removeFileAt: (index) => set((state) => {
    const nextFiles = state.files.filter((_, i) => i !== index);
    const currentFileStillExists = state.file
      ? nextFiles.some((f) => f.name === state.file?.name && f.size === state.file?.size && f.lastModified === state.file?.lastModified)
      : false;

    return {
      files: nextFiles,
      file: currentFileStillExists ? state.file : (nextFiles[0] || null),
      preview: nextFiles.length ? state.preview : null,
      columnMappings: nextFiles.length ? state.columnMappings : [],
      tableName: nextFiles.length ? state.tableName : '',
    };
  }),
  setPreview: (preview) => set({ preview }),
  setDelimiter: (delimiter) => set({ delimiter }),
  setHasHeader: (hasHeader) => set({ hasHeader }),
  setEncoding: (encoding) => set({ encoding }),
  
  setConnectionId: (id) => set({ connectionId: id }),
  setDatabase: (database) => set({ database }),
  setSchema: (schema) => set({ schema }),
  setTableName: (tableName) => set({ tableName }),
  setImportMode: (mode) => set({ importMode: mode }),
  
  setColumnMappings: (mappings) => set({ columnMappings: mappings }),
  updateColumnMapping: (index, mapping) => set((state) => ({
    columnMappings: state.columnMappings.map((m, i) => i === index ? { ...m, ...mapping } : m),
  })),
  
  setBatchSize: (size) => set({ batchSize: size }),
  setErrorStrategy: (strategy) => set({ errorStrategy: strategy }),
  setMaxErrors: (max) => set({ maxErrors: max }),
  setTruncateTable: (truncate) => set({ truncateTable: truncate }),
  
  setIsImporting: (importing) => set({ isImporting: importing }),
  setImportProgress: (progress) => set({ importProgress: progress }),
  setImportResult: (result) => set({ importResult: result }),
  setBatchImportResults: (results) => set({ batchImportResults: results }),
}));
