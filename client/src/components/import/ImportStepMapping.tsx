import { useImportStore } from '../../stores/importStore';
import { Card, CardContent } from '../ui/card';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import { ArrowRight } from 'lucide-react';

const DATA_TYPES = [
  { value: 'text', label: 'TEXT' },
  { value: 'varchar(255)', label: 'VARCHAR(255)' },
  { value: 'integer', label: 'INTEGER' },
  { value: 'bigint', label: 'BIGINT' },
  { value: 'numeric', label: 'NUMERIC' },
  { value: 'decimal(10,2)', label: 'DECIMAL(10,2)' },
  { value: 'boolean', label: 'BOOLEAN' },
  { value: 'date', label: 'DATE' },
  { value: 'timestamp', label: 'TIMESTAMP' },
  { value: 'json', label: 'JSON' },
  { value: 'jsonb', label: 'JSONB' },
];

export function ImportStepMapping() {
  const { columnMappings, preview, updateColumnMapping, importMode } = useImportStore();

  if (!preview) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No preview data available
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Map Columns</h3>
        <p className="text-sm text-muted-foreground">
          Configure how CSV columns map to database columns. Adjust data types and constraints as needed.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            {/* Header */}
            <div className="grid grid-cols-12 gap-4 pb-3 border-b font-medium text-sm">
              <div className="col-span-3">CSV Column</div>
              <div className="col-span-1 flex justify-center">
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="col-span-3">Table Column</div>
              <div className="col-span-3">Data Type</div>
              <div className="col-span-2 text-center">Nullable</div>
            </div>

            {/* Column Mappings */}
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
              {columnMappings.map((mapping, index) => (
                <div key={index} className="grid grid-cols-12 gap-4 items-center">
                  {/* CSV Column */}
                  <div className="col-span-3">
                    <div className="flex flex-col">
                      <span className="font-medium text-sm truncate" title={mapping.csvColumn}>
                        {mapping.csvColumn}
                      </span>
                      {preview.rows[0] && (
                        <span className="text-xs text-muted-foreground truncate" title={preview.rows[0][mapping.csvColumn]}>
                          e.g., {preview.rows[0][mapping.csvColumn] || 'null'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Arrow */}
                  <div className="col-span-1 flex justify-center">
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>

                  {/* Table Column */}
                  <div className="col-span-3">
                    <Input
                      value={mapping.tableColumn}
                      onChange={(e) => updateColumnMapping(index, { tableColumn: e.target.value })}
                      placeholder="Column name"
                      disabled={importMode !== 'create'}
                      className="h-9"
                    />
                  </div>

                  {/* Data Type */}
                  <div className="col-span-3">
                    <Select
                      value={mapping.dataType}
                      onValueChange={(value) => updateColumnMapping(index, { dataType: value })}
                      disabled={importMode !== 'create'}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DATA_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Nullable */}
                  <div className="col-span-2 flex justify-center">
                    <Checkbox
                      checked={mapping.nullable}
                      onCheckedChange={(checked) => 
                        updateColumnMapping(index, { nullable: checked === true })
                      }
                      disabled={importMode !== 'create'}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="pt-3 border-t text-sm text-muted-foreground">
              <div className="flex justify-between">
                <span>{columnMappings.length} columns mapped</span>
                {importMode !== 'create' && (
                  <span className="text-amber-600">
                    Column configuration locked (appending to existing table)
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Type Guide */}
      <Card className="bg-muted/30">
        <CardContent className="pt-6">
          <Label className="text-sm font-semibold mb-2 block">Data Type Guide</Label>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
            <div><span className="font-medium">TEXT:</span> Variable length text</div>
            <div><span className="font-medium">VARCHAR:</span> Limited length text</div>
            <div><span className="font-medium">INTEGER:</span> Whole numbers (-2B to 2B)</div>
            <div><span className="font-medium">BIGINT:</span> Large whole numbers</div>
            <div><span className="font-medium">NUMERIC:</span> Decimal numbers</div>
            <div><span className="font-medium">BOOLEAN:</span> True/False values</div>
            <div><span className="font-medium">DATE:</span> Date only (YYYY-MM-DD)</div>
            <div><span className="font-medium">TIMESTAMP:</span> Date and time</div>
            <div><span className="font-medium">JSON:</span> JSON data</div>
            <div><span className="font-medium">JSONB:</span> Binary JSON (faster)</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
