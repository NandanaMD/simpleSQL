import axios from 'axios';
import type {
  Connection,
  ConnectionConfig,
  ConnectionTestResult,
  QueryRequest,
  QueryResult,
  Database,
  Schema,
  Table,
  TableStructure,
  CSVPreview,
  CSVImportRequest,
  CSVImportResult,
  ExplainRequest,
  ExplainResult,
  ApiResponse,
} from '@sql-ide/shared';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add response interceptor to extract error messages
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Extract the actual error message from the response
    if (error.response?.data?.error) {
      // Server returned an error message - use it
      throw new Error(error.response.data.error);
    } else if (error.response?.data?.message) {
      throw new Error(error.response.data.message);
    } else if (error.response?.statusText) {
      throw new Error(`Request failed: ${error.response.statusText}`);
    } else if (error.request) {
      throw new Error('No response from server. Check your network connection.');
    } else {
      throw new Error(error.message || 'Request failed');
    }
  }
);

// Connections
export async function testConnection(config: ConnectionConfig): Promise<ConnectionTestResult> {
  const response = await api.post<ApiResponse<ConnectionTestResult>>('/connections/test', config);
  return response.data.data!;
}

export async function createConnection(config: ConnectionConfig): Promise<Connection> {
  const response = await api.post<ApiResponse<Connection>>('/connections', config);
  return response.data.data!;
}

export async function getAllConnections(): Promise<Connection[]> {
  const response = await api.get<ApiResponse<Connection[]>>('/connections');
  return response.data.data!;
}

export async function getConnection(id: string): Promise<Connection> {
  const response = await api.get<ApiResponse<Connection>>(`/connections/${id}`);
  return response.data.data!;
}

export async function updateConnection(id: string, config: Partial<ConnectionConfig>): Promise<Connection> {
  const response = await api.put<ApiResponse<Connection>>(`/connections/${id}`, config);
  return response.data.data!;
}

export async function deleteConnection(id: string): Promise<void> {
  await api.delete(`/connections/${id}`);
}

// Query
export async function executeQuery(request: QueryRequest): Promise<QueryResult> {
  const response = await api.post<ApiResponse<QueryResult>>('/query', request);
  return response.data.data!;
}

// Metadata
export async function getDatabases(connectionId: string): Promise<Database[]> {
  const response = await api.get<ApiResponse<Database[]>>(`/metadata/databases/${connectionId}`);
  return response.data.data!;
}

export async function getSchemas(connectionId: string, database: string): Promise<Schema[]> {
  const response = await api.get<ApiResponse<Schema[]>>(`/metadata/schemas/${connectionId}/${database}`);
  return response.data.data!;
}

export async function getTables(connectionId: string, database: string, schema: string): Promise<Table[]> {
  const response = await api.get<ApiResponse<Table[]>>(`/metadata/tables/${connectionId}/${database}/${schema}`);
  return response.data.data!;
}

export async function getTableStructure(
  connectionId: string,
  database: string,
  schema: string,
  table: string
): Promise<TableStructure> {
  const response = await api.get<ApiResponse<TableStructure>>(
    `/metadata/table-structure/${connectionId}/${database}/${schema}/${table}`
  );
  return response.data.data!;
}

// CSV Import
export async function previewCSV(file: File): Promise<CSVPreview> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await api.post<ApiResponse<CSVPreview>>('/import/preview', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    timeout: 120000, // 2 minutes for preview
  });
  return response.data.data!;
}

export async function importCSV(file: File, request: CSVImportRequest): Promise<CSVImportResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('importRequest', JSON.stringify(request));

  try {
    const response = await api.post<ApiResponse<CSVImportResult>>('/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 600000, // 10 minutes for large files
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });
    return response.data.data!;
  } catch (error: any) {
    // Improve error messages
    if (error.response) {
      const errorMsg = error.response.data?.error || error.response.statusText || 'Import failed';
      throw new Error(`Import failed: ${errorMsg}`);
    } else if (error.request) {
      throw new Error('Import failed: No response from server. Check your network connection.');
    } else if (error.code === 'ECONNABORTED') {
      throw new Error('Import failed: Request timeout. The file may be too large or the server is busy.');
    }
    throw new Error(error.message || 'Import failed');
  }
}

// Explain
export async function explainQuery(request: ExplainRequest): Promise<ExplainResult> {
  const response = await api.post<ApiResponse<ExplainResult>>('/explain', request);
  return response.data.data!;
}

export default api;
