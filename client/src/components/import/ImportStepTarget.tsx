import { useEffect, useState } from 'react';
import { useImportStore } from '../../stores/importStore';
import { useConnectionStore } from '../../stores/connectionStore';
import { Card, CardContent } from '../ui/card';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs';
import * as api from '../../lib/api';
import { toast } from 'sonner';
import type { Database, Schema, Table } from '@sql-ide/shared';

export function ImportStepTarget() {
  const {
    connectionId,
    database,
    schema,
    tableName,
    importMode,
    preselectedConnectionId,
    preselectedDatabase,
    preselectedSchema,
    setConnectionId,
    setDatabase,
    setSchema,
    setTableName,
    setImportMode,
  } = useImportStore();

  const { connections } = useConnectionStore();
  const [databases, setDatabases] = useState<Database[]>([]);
  const [schemas, setSchemas] = useState<Schema[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [isLoadingDatabases, setIsLoadingDatabases] = useState(false);
  const [isLoadingSchemas, setIsLoadingSchemas] = useState(false);
  const [isLoadingTables, setIsLoadingTables] = useState(false);

  // Load databases when connection changes
  useEffect(() => {
    if (connectionId) {
      setIsLoadingDatabases(true);
      api.getDatabases(connectionId)
        .then((dbs) => {
          setDatabases(dbs);
          // Auto-select preselected database if available
          if (preselectedDatabase && dbs.some(db => db.name === preselectedDatabase)) {
            setDatabase(preselectedDatabase);
          }
        })
        .catch((error) => {
          toast.error('Failed to load databases');
          console.error(error);
        })
        .finally(() => setIsLoadingDatabases(false));
    } else {
      setDatabases([]);
    }
  }, [connectionId, preselectedDatabase, setDatabase]);

  // Load schemas when database changes
  useEffect(() => {
    if (connectionId && database) {
      setIsLoadingSchemas(true);
      api.getSchemas(connectionId, database)
        .then((schms) => {
          setSchemas(schms);
          // Auto-select preselected schema if available
          if (preselectedSchema && schms.some(s => s.name === preselectedSchema)) {
            setSchema(preselectedSchema);
          } else if (!schema && schms.some(s => s.name === 'public')) {
            setSchema('public');
          }
        })
        .catch((error) => {
          toast.error('Failed to load schemas');
          console.error(error);
        })
        .finally(() => setIsLoadingSchemas(false));
    } else {
      setSchemas([]);
    }
  }, [connectionId, database, preselectedSchema, schema, setSchema]);

  // Load tables when schema changes
  useEffect(() => {
    if (connectionId && database && schema) {
      setIsLoadingTables(true);
      api.getTables(connectionId, database, schema)
        .then((tbls) => {
          setTables(tbls.filter(t => t.type === 'table')); // Only show tables, not views
        })
        .catch((error) => {
          toast.error('Failed to load tables');
          console.error(error);
        })
        .finally(() => setIsLoadingTables(false));
    } else {
      setTables([]);
    }
  }, [connectionId, database, schema]);

  // Initialize with preselected connection
  useEffect(() => {
    if (preselectedConnectionId && !connectionId) {
      setConnectionId(preselectedConnectionId);
    }
  }, [preselectedConnectionId, connectionId, setConnectionId]);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Choose Target</h3>
        <p className="text-sm text-muted-foreground">
          Select the connection, database, schema, and table where your data will be imported.
        </p>
      </div>

      {/* Connection Selection */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-2">
            <Label>Connection *</Label>
            <Select value={connectionId} onValueChange={setConnectionId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a connection" />
              </SelectTrigger>
              <SelectContent>
                {connections.map((conn) => (
                  <SelectItem key={conn.id} value={conn.id}>
                    {conn.name} ({conn.host}:{conn.port})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Database *</Label>
            <Select 
              value={database} 
              onValueChange={setDatabase}
              disabled={!connectionId || isLoadingDatabases}
            >
              <SelectTrigger>
                <SelectValue placeholder={isLoadingDatabases ? "Loading..." : "Select a database"} />
              </SelectTrigger>
              <SelectContent>
                {databases.map((db) => (
                  <SelectItem key={db.name} value={db.name}>
                    {db.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Schema *</Label>
            <Select 
              value={schema} 
              onValueChange={setSchema}
              disabled={!database || isLoadingSchemas}
            >
              <SelectTrigger>
                <SelectValue placeholder={isLoadingSchemas ? "Loading..." : "Select a schema"} />
              </SelectTrigger>
              <SelectContent>
                {schemas.map((schm) => (
                  <SelectItem key={schm.name} value={schm.name}>
                    {schm.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Import Mode */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-2">
            <Label>Import Mode *</Label>
            <Tabs value={importMode} onValueChange={(v) => setImportMode(v as 'create' | 'append' | 'replace')}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="create">Create New Table</TabsTrigger>
                <TabsTrigger value="append" disabled={!schema || isLoadingTables}>
                  Append to Existing
                </TabsTrigger>
                <TabsTrigger value="replace" disabled={!schema || isLoadingTables}>
                  Replace Existing
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <p className="text-xs text-muted-foreground">
              {importMode === 'create' && 'Create a new table with the imported data'}
              {importMode === 'append' && 'Add data to an existing table'}
              {importMode === 'replace' && 'Delete all existing data and replace with imported data'}
            </p>
          </div>

          {importMode === 'create' ? (
            <div className="space-y-2">
              <Label>New Table Name *</Label>
              <Input
                value={tableName}
                onChange={(e) => setTableName(e.target.value)}
                placeholder="Enter table name"
              />
              <p className="text-xs text-muted-foreground">
                Use lowercase letters, numbers, and underscores only
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Existing Table *</Label>
              <Select 
                value={tableName} 
                onValueChange={setTableName}
                disabled={isLoadingTables}
              >
                <SelectTrigger>
                  <SelectValue placeholder={isLoadingTables ? "Loading..." : "Select a table"} />
                </SelectTrigger>
                <SelectContent>
                  {tables.map((tbl) => (
                    <SelectItem key={tbl.name} value={tbl.name}>
                      {tbl.name}
                      {tbl.rowCount !== undefined && (
                        <span className="text-muted-foreground ml-2">
                          ({tbl.rowCount.toLocaleString()} rows)
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
