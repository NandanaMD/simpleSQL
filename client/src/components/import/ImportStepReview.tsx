import { useState, useEffect, useRef } from 'react';
import { useImportStore } from '../../stores/importStore';
import { useConnectionStore } from '../../stores/connectionStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { Label } from '../ui/label';
import { 
  Upload, 
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

// Import Button Component for Footer
export function ImportButton() {
  const {
    file,
    files,
    connectionId,
    database,
    schema,
    tableName,
    importMode,
    columnMappings,
    isImporting,
    setIsImporting,
    setImportProgress,
    setImportResult,
    setBatchImportResults,
    closeWizard,
  } = useImportStore();

  const autoCloseTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (autoCloseTimerRef.current !== null) {
        window.clearTimeout(autoCloseTimerRef.current);
      }
    };
  }, []);

  const toTableNameFromFile = (fileName: string) => fileName
    .replace(/\.csv$/i, '')
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .toLowerCase();

  const buildMappingsForFile = async (currentFile: File) => {
    if (importMode !== 'create' || files.length <= 1) {
      return columnMappings;
    }

    const previewData = await api.previewCSV(currentFile);
    const templateMappingByColumn = new Map(
      columnMappings.map((mapping) => [mapping.csvColumn, mapping])
    );

    return previewData.headers.map((header) => {
      const existing = templateMappingByColumn.get(header);
      return {
        csvColumn: header,
        tableColumn: existing?.tableColumn || header.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase(),
        dataType: existing?.dataType || previewData.inferredTypes[header] || 'text',
        nullable: existing?.nullable ?? true,
      };
    });
  };

  const handleImport = async () => {
    const filesToImport = files.length > 0 ? files : (file ? [file] : []);
    if (!filesToImport.length) return;

    if (autoCloseTimerRef.current !== null) {
      window.clearTimeout(autoCloseTimerRef.current);
      autoCloseTimerRef.current = null;
    }

    setIsImporting(true);
    setImportProgress(0);
    setImportResult(null);
    setBatchImportResults([]);

    try {
      const perFileResults: Array<{
        fileName: string;
        tableName: string;
        success: boolean;
        rowsInserted: number;
        duration: number;
        errors: Array<{ row: number; message: string }>;
        message: string;
      }> = [];

      let totalRowsInserted = 0;
      let totalDuration = 0;
      const aggregatedErrors: Array<{ row: number; message: string }> = [];

      for (let index = 0; index < filesToImport.length; index += 1) {
        const currentFile = filesToImport[index];
        const currentTableName = importMode === 'create' && filesToImport.length > 1
          ? toTableNameFromFile(currentFile.name)
          : tableName;
        const currentMappings = await buildMappingsForFile(currentFile);

        setImportProgress((index / filesToImport.length) * 100);

        try {
          const result = await api.importCSV(currentFile, {
            connectionId,
            database,
            schema,
            tableName: currentTableName,
            createTable: importMode === 'create',
            columnMappings: currentMappings,
          });

          perFileResults.push({
            fileName: currentFile.name,
            tableName: currentTableName,
            success: result.success,
            rowsInserted: result.rowsInserted,
            duration: result.duration,
            errors: result.errors,
            message: result.message,
          });

          totalRowsInserted += result.rowsInserted;
          totalDuration += result.duration;
          aggregatedErrors.push(...result.errors);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Import failed';

          perFileResults.push({
            fileName: currentFile.name,
            tableName: currentTableName,
            success: false,
            rowsInserted: 0,
            duration: 0,
            errors: [{ row: 0, message: errorMessage }],
            message: errorMessage,
          });

          aggregatedErrors.push({ row: 0, message: `${currentFile.name}: ${errorMessage}` });
        }

        setImportProgress(((index + 1) / filesToImport.length) * 100);
      }

      setBatchImportResults(perFileResults);

      const failedCount = perFileResults.filter((result) => !result.success).length;

      setImportResult({
        success: failedCount === 0,
        rowsInserted: totalRowsInserted,
        duration: totalDuration,
        errors: aggregatedErrors,
        message: failedCount === 0
          ? `Successfully imported ${filesToImport.length} file(s)`
          : `Imported ${filesToImport.length - failedCount}/${filesToImport.length} file(s)`,
      });

      if (failedCount === 0) {
        toast.success(`Successfully imported ${filesToImport.length} file(s)`);
        autoCloseTimerRef.current = window.setTimeout(() => {
          closeWizard();
          autoCloseTimerRef.current = null;
        }, 2500);
      } else {
        toast.error(`${failedCount} file(s) failed to import`);
      }
    } catch (error) {
      setImportProgress(0);
      toast.error(error instanceof Error ? error.message : 'Import failed');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Button
      onClick={handleImport}
      disabled={isImporting}
      size="lg"
      className="gap-2 bg-green-600 hover:bg-green-700 text-white"
    >
      {isImporting ? (
        <>
          <Loader2 className="h-5 w-5 animate-spin" />
          Importing...
        </>
      ) : (
        <>
          <Upload className="h-5 w-5" />
          Import Data
        </>
      )}
    </Button>
  );
}

ImportButton.displayName = 'ImportButton';

export function ImportStepReview() {
  const {
    file,
    files,
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
    batchImportResults,
    closeWizard,
  } = useImportStore();

  const { connections } = useConnectionStore();
  const [startTime, setStartTime] = useState<number | null>(null);

  const connection = connections.find(c => c.id === connectionId);

  useEffect(() => {
    if (isImporting && importProgress === 0) {
      setStartTime(Date.now());
    }
  }, [isImporting, importProgress]);

  const filesToImport = files.length > 0 ? files : (file ? [file] : []);
  const totalFiles = filesToImport.length;

  const downloadErrorLog = () => {
    if (!importResult?.errors.length) return;

    if (batchImportResults.length > 0) {
      const csv = [
        'File,Row Number,Message',
        ...batchImportResults.flatMap((result) => result.errors.map((error) => (
          `${result.fileName},${error.row},"${error.message.replace(/"/g, '""')}"`
        ))),
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `import-errors-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

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
              <CardTitle className="text-sm">Source Files</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <p className="font-medium text-sm">
                {totalFiles === 1 ? filesToImport[0]?.name : `${totalFiles} files selected`}
              </p>
              <p className="text-xs text-muted-foreground">
                {totalFiles > 1
                  ? `Template: ${filesToImport[0]?.name || 'N/A'}`
                  : `${preview?.rowCount.toLocaleString()} rows • ${preview?.headers.length} columns`}
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

      {/* Import Progress */}
      {isImporting && (
        <Card>
          <CardContent className="pt-6">
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
          </CardContent>
        </Card>
      )}

      {/* Ready to Import Message */}
      {!isImporting && !importResult && (
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm font-medium">
                Ready to import {totalFiles} file{totalFiles === 1 ? '' : 's'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Click "Import Data" below to begin
              </p>
            </div>
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

            {batchImportResults.length > 0 && (
              <div className="space-y-2">
                <Label className="text-muted-foreground">Per-file Results</Label>
                <div className="max-h-40 overflow-y-auto rounded-md border divide-y">
                  {batchImportResults.map((result) => (
                    <div key={`${result.fileName}-${result.tableName}`} className="px-3 py-2 text-xs flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{result.fileName}</p>
                        <p className="text-muted-foreground truncate">{schema}.{result.tableName}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={result.success ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                          {result.success ? 'Done' : 'Failed'}
                        </p>
                        <p className="text-muted-foreground">{result.rowsInserted.toLocaleString()} rows</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
