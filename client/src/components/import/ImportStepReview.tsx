import { useState } from 'react';
import { useImportStore } from '../../stores/importStore';
import { useConnectionStore } from '../../stores/connectionStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { Label } from '../ui/label';
import { 
  PlayCircle, 
  CheckCircle2, 
  XCircle, 
  Download, 
  AlertCircle, 
  FileText,
  Database,
  Table,
  Columns,
  Settings,
  Loader2
} from 'lucide-react';
import * as api from '../../lib/api';
import { toast } from 'sonner';

export function ImportStepReview() {
  const {
    file,
    preview,
    connectionId,
    database,
    schema,
    tableName,
    importMode,
    columnMappings,
    batchSize,
    errorStrategy,
    truncateTable,
    isImporting,
    importProgress,
    importResult,
    setIsImporting,
    setImportProgress,
    setImportResult,
    closeWizard,
  } = useImportStore();

  const { connections } = useConnectionStore();
  const [startTime, setStartTime] = useState<number | null>(null);

  const connection = connections.find(c => c.id === connectionId);

  const handleImport = async () => {
    if (!file) return;

    setIsImporting(true);
    setImportProgress(0);
    setImportResult(null);
    setStartTime(Date.now());

    try {
      // Simulate progress (since we don't have real-time updates)
      let currentProgress = 0;
      const progressInterval = setInterval(() => {
        currentProgress = Math.min(currentProgress + Math.random() * 10, 90);
        setImportProgress(currentProgress);
      }, 500);

      const result = await api.importCSV(file, {
        connectionId,
        database,
        schema,
        tableName,
        createTable: importMode === 'create',
        columnMappings,
      });

      clearInterval(progressInterval);
      setImportProgress(100);
      setImportResult(result);

      if (result.success) {
        toast.success(`Successfully imported ${result.rowsInserted.toLocaleString()} rows`);
      } else {
        toast.error('Import completed with errors');
      }
    } catch (error) {
      setImportProgress(0);
      toast.error(error instanceof Error ? error.message : 'Import failed');
    } finally {
      setIsImporting(false);
    }
  };

  const downloadErrorLog = () => {
    if (!importResult?.errors.length) return;

    const csv = [
      'Row Number,Message',
      ...importResult.errors.map(err => `${err.row},"${err.message.replace(/"/g, '""')}"`),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `import-errors-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Review & Import</h3>
        <p className="text-sm text-muted-foreground">
          Review your configuration and start the import process.
        </p>
      </div>

      {/* Configuration Summary */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm">Source File</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <p className="font-medium text-sm">{file?.name}</p>
              <p className="text-xs text-muted-foreground">
                {preview?.rowCount.toLocaleString()} rows • {preview?.headers.length} columns
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm">Target</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <p className="font-medium text-sm">{connection?.name}</p>
              <p className="text-xs text-muted-foreground">
                {database}.{schema}.{tableName}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Table className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm">Import Mode</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <p className="font-medium text-sm capitalize">{importMode} Table</p>
              {truncateTable && (
                <p className="text-xs text-amber-600">
                  Will truncate before import
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm">Options</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <p className="text-xs">Batch: {batchSize.toLocaleString()}</p>
              <p className="text-xs">Errors: {errorStrategy}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Column Mappings Preview */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Columns className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm">Column Mappings</CardTitle>
          </div>
          <CardDescription>
            {columnMappings.length} columns will be imported
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-h-40 overflow-y-auto">
            <div className="grid grid-cols-3 gap-2 text-xs">
              {columnMappings.slice(0, 12).map((mapping, idx) => (
                <div key={idx} className="flex items-center gap-2 py-1">
                  <span className="font-medium truncate">{mapping.tableColumn}</span>
                  <span className="text-muted-foreground">({mapping.dataType})</span>
                </div>
              ))}
            </div>
            {columnMappings.length > 12 && (
              <p className="text-xs text-muted-foreground mt-2">
                ... and {columnMappings.length - 12} more columns
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Import Controls */}
      {!importResult && (
        <Card>
          <CardContent className="pt-6">
            {!isImporting ? (
              <div className="text-center space-y-4">
                <p className="text-sm text-muted-foreground">
                  Ready to import {preview?.rowCount.toLocaleString()} rows
                </p>
                <Button onClick={handleImport} size="lg" className="gap-2">
                  <PlayCircle className="h-5 w-5" />
                  Start Import
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span className="font-medium">Importing data...</span>
                </div>
                <Progress value={importProgress} className="h-2" />
                <p className="text-sm text-center text-muted-foreground">
                  {importProgress.toFixed(0)}% complete
                  {startTime && importProgress > 0 && (
                    <> • {formatDuration(Date.now() - startTime)} elapsed</>
                  )}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Import Result */}
      {importResult && (
        <Card className={importResult.success ? 'border-green-500' : 'border-red-500'}>
          <CardHeader>
            <div className="flex items-center gap-2">
              {importResult.success ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              <CardTitle>
                {importResult.success ? 'Import Completed' : 'Import Failed'}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <Label className="text-muted-foreground">Rows Imported</Label>
                <p className="text-2xl font-bold">{importResult.rowsInserted.toLocaleString()}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Duration</Label>
                <p className="text-2xl font-bold">{formatDuration(importResult.duration)}</p>
              </div>
            </div>

            {importResult.errors.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-amber-600">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    {importResult.errors.length} rows failed to import
                  </span>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={downloadErrorLog}
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download Error Log
                </Button>
              </div>
            )}

            <div className="flex gap-2 pt-4">
              <Button onClick={closeWizard} className="flex-1">
                Close Wizard
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
