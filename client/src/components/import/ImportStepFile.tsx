import { useCallback, useState } from 'react';
import { useImportStore } from '../../stores/importStore';
import { Card, CardContent } from '../ui/card';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { FileUp, Upload, File, AlertCircle, Loader2 } from 'lucide-react';
import * as api from '../../lib/api';
import { toast } from 'sonner';

export function ImportStepFile() {
  const {
    files,
    preview,
    setFiles,
    removeFileAt,
    setPreview,
    setColumnMappings,
    setTableName,
  } = useImportStore();

  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const loadPreviewForTemplateFile = useCallback(async (selectedFile: File | null) => {
    if (!selectedFile) return;

    // Validate file type
    if (!selectedFile.name.endsWith('.csv')) {
      toast.error('Please select a CSV file');
      return;
    }

    // Validate file size (100MB)
    const maxSize = 100 * 1024 * 1024;
    if (selectedFile.size > maxSize) {
      toast.error('File size exceeds 100MB limit');
      return;
    }

    setIsLoading(true);

    try {
      // Get preview from backend
      const previewData = await api.previewCSV(selectedFile);
      setPreview(previewData);

      // Auto-generate table name from filename
      const tableName = selectedFile.name
        .replace('.csv', '')
        .replace(/[^a-zA-Z0-9_]/g, '_')
        .toLowerCase();
      setTableName(tableName);

      // Initialize column mappings from preview
      const mappings = previewData.headers.map((header) => ({
        csvColumn: header,
        tableColumn: header.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase(),
        dataType: previewData.inferredTypes[header] || 'text',
        nullable: true,
      }));
      setColumnMappings(mappings);

      toast.success(`Preview loaded: ${previewData.rowCount.toLocaleString()} rows detected`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load preview');
      setFiles([]);
      setPreview(null);
    } finally {
      setIsLoading(false);
    }
  }, [setFiles, setPreview, setColumnMappings, setTableName]);

  const handleFilesSelect = useCallback(async (selectedFiles: File[]) => {
    if (!selectedFiles.length) return;

    const maxSize = 100 * 1024 * 1024;
    const validFiles = selectedFiles.filter((f) => f.name.toLowerCase().endsWith('.csv') && f.size <= maxSize);

    const invalidTypeCount = selectedFiles.filter((f) => !f.name.toLowerCase().endsWith('.csv')).length;
    const oversizedCount = selectedFiles.filter((f) => f.size > maxSize).length;

    if (invalidTypeCount > 0) {
      toast.error(`${invalidTypeCount} file(s) were skipped (only .csv is supported)`);
    }

    if (oversizedCount > 0) {
      toast.error(`${oversizedCount} file(s) were skipped (size exceeds 100MB)`);
    }

    if (!validFiles.length) {
      return;
    }

    setFiles(validFiles);
    await loadPreviewForTemplateFile(validFiles[0]);
  }, [loadPreviewForTemplateFile, setFiles]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length) {
      void handleFilesSelect(droppedFiles);
    }
  }, [handleFilesSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files ? Array.from(e.target.files) : [];
    if (selectedFiles.length) {
      void handleFilesSelect(selectedFiles);
    }
  }, [handleFilesSelect]);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Select CSV File</h3>
        <p className="text-sm text-muted-foreground">
          Upload one or more CSV files to import into your database. Maximum file size: 100MB each.
        </p>
      </div>

      {/* File Upload Area */}
      <Card
        className={`
          border-2 border-dashed transition-colors cursor-pointer
          ${isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'}
          ${files.length > 0 ? 'bg-muted/30' : ''}
        `}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => files.length === 0 && document.getElementById('file-input')?.click()}
      >
        <CardContent className="flex flex-col items-center justify-center py-12">
          {isLoading ? (
            <>
              <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
              <p className="text-sm text-muted-foreground">Loading preview...</p>
            </>
          ) : files.length > 0 ? (
            <>
              <File className="h-12 w-12 text-primary mb-4" />
              <p className="text-sm font-medium">
                {files.length === 1 ? files[0].name : `${files.length} CSV files selected`}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {files.length === 1
                  ? formatFileSize(files[0].size)
                  : `${formatFileSize(files.reduce((sum, current) => sum + current.size, 0))} total`}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={(e) => {
                  e.stopPropagation();
                  setFiles([]);
                  setPreview(null);
                }}
              >
                Change Files
              </Button>
            </>
          ) : (
            <>
              <div className="rounded-full bg-primary/10 p-4 mb-4">
                <FileUp className="h-8 w-8 text-primary" />
              </div>
              <p className="text-sm font-medium mb-1">
                Drag and drop your CSV files here
              </p>
              <p className="text-xs text-muted-foreground mb-4">or</p>
              <Button variant="outline" size="sm">
                <Upload className="h-4 w-4 mr-2" />
                Browse Files
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <input
        id="file-input"
        type="file"
        accept=".csv"
        multiple
        className="hidden"
        onChange={handleFileInput}
      />

      {files.length > 1 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <Label className="text-base font-semibold">Selected Files Queue</Label>
              <span className="text-xs text-muted-foreground">Template preview uses first file</span>
            </div>
            <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
              {files.map((queuedFile, idx) => (
                <div
                  key={`${queuedFile.name}-${queuedFile.lastModified}-${queuedFile.size}`}
                  className="flex items-center justify-between rounded-md border px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{queuedFile.name}</p>
                    <p className="text-xs text-muted-foreground">{formatFileSize(queuedFile.size)}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFileAt(idx);
                    }}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preview */}
      {preview && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <Label className="text-base font-semibold">Data Preview</Label>
              <span className="text-sm text-muted-foreground">
                {preview.rowCount.toLocaleString()} rows • {preview.headers.length} columns
              </span>
            </div>

            <div className="border rounded-md overflow-hidden">
              <div className="overflow-x-auto max-h-64 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      {preview.headers.map((header, idx) => (
                        <th key={idx} className="px-3 py-2 text-left font-medium border-r last:border-r-0">
                          <div className="flex flex-col">
                            <span className="truncate max-w-[150px]" title={header}>{header}</span>
                            <span className="text-xs text-muted-foreground font-normal">
                              {preview.inferredTypes[header]}
                            </span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row, rowIdx) => (
                      <tr key={rowIdx} className="border-t hover:bg-muted/50">
                        {preview.headers.map((header, colIdx) => (
                          <td key={colIdx} className="px-3 py-2 border-r last:border-r-0">
                            <span className="truncate block max-w-[150px]" title={row[header]}>
                              {row[header] || <span className="text-muted-foreground italic">null</span>}
                            </span>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {preview.rows.length < preview.rowCount && (
              <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                <AlertCircle className="h-3 w-3" />
                <span>Showing first {preview.rows.length} rows of {preview.rowCount.toLocaleString()}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
