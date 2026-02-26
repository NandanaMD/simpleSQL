// Connection Types
export interface Connection {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  password: string;
  defaultDatabase: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConnectionConfig {
  name: string;
  host: string;
  port: number;
  username: string;
  password: string;
  defaultDatabase: string;
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  error?: string;
}

// Query Types
export interface QueryRequest {
  connectionId: string;
  sql: string;
  database?: string;
  timeout?: number;
}

export interface QueryField {
  name: string;
  dataTypeID: number;
  tableID: number;
  columnID: number;
  dataType: string;
}

export interface QueryResult {
  rows: Record<string, unknown>[];
  rowCount: number;
  fields: QueryField[];
  executionTime: number;
  command: string;
}

export interface QueryError {
  message: string;
  code?: string;
  detail?: string;
  hint?: string;
  position?: string;
  line?: number;
  column?: number;
}

// Metadata Types
export interface Database {
  name: string;
  owner: string;
  encoding: string;
  size?: string;
}

export interface Schema {
  name: string;
  owner: string;
}

export interface Table {
  name: string;
  schema: string;
  type: 'table' | 'view' | 'materialized_view';
  rowCount?: number;
  size?: string;
}

export interface Column {
  name: string;
  dataType: string;
  isNullable: boolean;
  defaultValue: string | null;
  maxLength: number | null;
  precision: number | null;
  scale: number | null;
  isPrimaryKey: boolean;
  isUnique: boolean;
  comment: string | null;
}

export interface Index {
  name: string;
  columns: string[];
  isUnique: boolean;
  isPrimary: boolean;
  indexType: string;
  definition: string;
}

export interface Constraint {
  name: string;
  type: 'PRIMARY KEY' | 'FOREIGN KEY' | 'UNIQUE' | 'CHECK';
  definition: string;
  columns: string[];
}

export interface TableStructure {
  table: Table;
  columns: Column[];
  indexes: Index[];
  constraints: Constraint[];
}

// CSV Import Types
export interface CSVImportRequest {
  connectionId: string;
  database: string;
  schema?: string; // Optional for SQLite compatibility
  tableName: string;
  createTable: boolean;
  columnMappings: ColumnMapping[];
}

export interface ColumnMapping {
  csvColumn: string;
  tableColumn: string;
  dataType: string;
  nullable: boolean;
}

export interface CSVImportProgress {
  status: 'parsing' | 'inserting' | 'completed' | 'error';
  rowsParsed: number;
  rowsInserted: number;
  totalRows?: number;
  errors: CSVImportError[];
}

export interface CSVImportError {
  row: number;
  column?: string;
  message: string;
}

export interface CSVImportResult {
  success: boolean;
  rowsInserted: number;
  duration: number;
  errors: CSVImportError[];
  message: string;
}

export interface CSVPreview {
  headers: string[];
  rows: Record<string, string>[];
  inferredTypes: Record<string, string>;
  rowCount: number;
}

// Explain Plan Types
export interface ExplainRequest {
  connectionId: string;
  sql: string;
  database?: string;
  analyze: boolean;
}

export interface ExplainNode {
  'Node Type': string;
  'Relation Name'?: string;
  'Schema'?: string;
  'Alias'?: string;
  'Startup Cost': number;
  'Total Cost': number;
  'Plan Rows': number;
  'Plan Width': number;
  'Actual Startup Time'?: number;
  'Actual Total Time'?: number;
  'Actual Rows'?: number;
  'Actual Loops'?: number;
  'Filter'?: string;
  'Join Type'?: string;
  'Index Cond'?: string;
  'Hash Cond'?: string;
  'Plans'?: ExplainNode[];
  [key: string]: unknown;
}

export interface ExplainResult {
  plan: ExplainNode;
  planningTime?: number;
  executionTime?: number;
  totalCost: number;
  queryText: string;
}

// API Response Types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// Editor Types
export interface EditorTab {
  id: string;
  title: string;
  content: string;
  isDirty: boolean;
  mode?: 'sql' | 'simple'; // Editor mode (default: 'sql')
  translatedSql?: string; // For SimpleSyntax mode - generated SQL
  connectionId?: string;
  database?: string;
  // Per-tab result state
  resultRows?: any[];
  resultColumns?: any[];
  resultCommand?: string;
  resultRowCount?: number;
  executionTime?: number;
  executionTimestamp?: Date;
  lastExecutedSql?: string;
  lastExecutionMode?: 'sql' | 'simple';
  lastExecutionConnectionId?: string;
  lastExecutionDatabase?: string;
  errorInfo?: string | null;
  decorations?: string[]; // Monaco decoration IDs
}

export interface QueryHistory {
  id: string;
  sql: string;
  connectionId: string;
  database: string;
  executedAt: string;
  executionTime: number;
  rowCount: number;
  success: boolean;
  mode?: 'sql' | 'simple'; // Editor mode used
  input?: string; // Original SimpleSyntax input (if mode=simple)
  translatedSql?: string; // Generated SQL (if mode=simple)
}

export type EditorMode = 'sql' | 'simple';
