import { useImportStore } from '../../stores/importStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import { AlertTriangle, Settings2, Zap } from 'lucide-react';

export function ImportStepOptions() {
  const {
    batchSize,
    errorStrategy,
    maxErrors,
    truncateTable,
    importMode,
    setBatchSize,
    setErrorStrategy,
    setMaxErrors,
    setTruncateTable,
  } = useImportStore();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Import Options</h3>
        <p className="text-sm text-muted-foreground">
          Configure advanced settings for the import process.
        </p>
      </div>

      {/* Performance Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            <CardTitle>Performance</CardTitle>
          </div>
          <CardDescription>
            Adjust batch size for optimal import speed
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Batch Size</Label>
            <Input
              type="number"
              value={batchSize}
              onChange={(e) => setBatchSize(parseInt(e.target.value) || 1000)}
              min={100}
              max={10000}
              step={100}
            />
            <p className="text-xs text-muted-foreground">
              Number of rows to insert per batch (100-10,000). Default: 1,000
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Error Handling */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <CardTitle>Error Handling</CardTitle>
          </div>
          <CardDescription>
            Define how to handle rows that fail to import
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Error Strategy</Label>
            <Select value={errorStrategy} onValueChange={(v) => setErrorStrategy(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="stop">
                  <div className="flex flex-col items-start">
                    <span className="font-medium">Stop on First Error</span>
                    <span className="text-xs text-muted-foreground">
                      Abort import immediately if any row fails
                    </span>
                  </div>
                </SelectItem>
                <SelectItem value="skip">
                  <div className="flex flex-col items-start">
                    <span className="font-medium">Skip Error Rows</span>
                    <span className="text-xs text-muted-foreground">
                      Skip failed rows and continue (recommended)
                    </span>
                  </div>
                </SelectItem>
                <SelectItem value="continue">
                  <div className="flex flex-col items-start">
                    <span className="font-medium">Continue Despite Errors</span>
                    <span className="text-xs text-muted-foreground">
                      Log errors but keep importing
                    </span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {errorStrategy !== 'stop' && (
            <div className="space-y-2">
              <Label>Maximum Errors</Label>
              <Input
                type="number"
                value={maxErrors}
                onChange={(e) => setMaxErrors(parseInt(e.target.value) || 100)}
                min={1}
                max={10000}
              />
              <p className="text-xs text-muted-foreground">
                Stop import if errors exceed this threshold
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Table Operations */}
      {(importMode === 'replace' || importMode === 'append') && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-primary" />
              <CardTitle>Table Operations</CardTitle>
            </div>
            <CardDescription>
              Additional operations to perform before import
            </CardDescription>
          </CardHeader>
          <CardContent>
            {importMode === 'replace' && (
              <div className="flex items-start space-x-2">
                <Checkbox
                  id="truncate"
                  checked={truncateTable}
                  onCheckedChange={(checked) => setTruncateTable(checked === true)}
                />
                <div className="grid gap-1.5 leading-none">
                  <Label
                    htmlFor="truncate"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Truncate table before import
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Faster than DELETE but cannot be rolled back. Use with caution.
                  </p>
                </div>
              </div>
            )}
            {importMode === 'append' && (
              <div className="text-sm text-muted-foreground">
                Data will be appended to the existing table without modifications.
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      <Card className="bg-muted/30">
        <CardContent className="pt-6">
          <Label className="text-sm font-semibold mb-3 block">Configuration Summary</Label>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Batch Size:</span>
              <span className="font-medium">{batchSize.toLocaleString()} rows</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Error Strategy:</span>
              <span className="font-medium capitalize">{errorStrategy}</span>
            </div>
            {errorStrategy !== 'stop' && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Max Errors:</span>
                <span className="font-medium">{maxErrors.toLocaleString()}</span>
              </div>
            )}
            {importMode === 'replace' && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Truncate Table:</span>
                <span className="font-medium">{truncateTable ? 'Yes' : 'No'}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
