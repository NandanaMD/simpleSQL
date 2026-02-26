import { useEffect, useState } from 'react';
import { useConnectionStore } from '../stores/connectionStore';
import { useExplorerStore } from '../stores/explorerStore';
import { useImportStore } from '../stores/importStore';
import { useEditorStore } from '../stores/editorStore';
import { BackupManager } from './BackupManager';
import * as api from '../lib/api';
import { ChevronRight, ChevronDown, Database, Table, Loader2, Check, CheckCircle2, FileUp, Code, Trash2, Edit2, Copy, RefreshCw, Eye, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from './ui/dialog';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Label } from './ui/label';

export function DatabaseExplorer() {
  const { connections, selectedConnectionId, selectedDatabase, setActiveConnection } = useConnectionStore();
  const { nodes, expandedNodes, loadingNodes, addConnection, toggleNode, setNodeChildren, setNodeLoading } = useExplorerStore();
  const { openWizard } = useImportStore();
  const { createTab, updateTabContent } = useEditorStore();
  const [contextMenu, setContextMenu] = useState<{ 
    x: number; 
    y: number; 
    nodeId: string; 
    connectionId: string; 
    database: string; 
    table?: string; 
    type: string 
  } | null>(null);
  const [createDbDialog, setCreateDbDialog] = useState<{ open: boolean; connectionId: string | null }>({ open: false, connectionId: null });
  const [newDbName, setNewDbName] = useState('');
  const [backupManager, setBackupManager] = useState<{ open: boolean; connectionId: string; database: string } | null>(null);

  useEffect(() => {
    // Add all connections to explorer when they change
    connections.forEach((conn) => {
      if (!nodes.find((n) => n.id === conn.id)) {
        addConnection(conn.id, conn.name);
      }
    });
  }, [connections, nodes, addConnection]);

  useEffect(() => {
    // Close context menu when clicking anywhere
    const handleClick = () => setContextMenu(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const handleToggle = async (nodeId: string, type: string, connectionId: string, database?: string) => {
    const isExpanded = expandedNodes.has(nodeId);

    if (!isExpanded) {
      setNodeLoading(nodeId, true);
      try {
        if (type === 'connection') {
          // Load databases
          const databases = await api.getDatabases(connectionId);
          const children = databases.map((db) => ({
            id: `${connectionId}:${db.name}`,
            type: 'database' as const,
            label: db.name,
            connectionId,
            database: db.name,
            isExpanded: false,
            isLoading: false,
          }));
          setNodeChildren(nodeId, children);
        } else if (type === 'database' && database) {
          // Load tables directly (SQLite doesn't use schemas in navigation)
          const tables = await api.getTables(connectionId, database, 'main');
          const children = tables.map((table) => ({
            id: `${connectionId}:${database}:${table.name}`,
            type: table.type === 'view' ? ('view' as const) : ('table' as const),
            label: table.name,
            connectionId,
            database,
            table: table.name,
            isExpanded: false,
            isLoading: false,
          }));
          setNodeChildren(nodeId, children);
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to load data');
      } finally {
        setNodeLoading(nodeId, false);
      }
    }

    toggleNode(nodeId);
  };

  const handleDatabaseClick = (connectionId: string, database: string) => {
    setActiveConnection(connectionId, database);
    toast.success(`Connected to ${database}`);
  };

  const handleConnectionDoubleClick = async (connectionId: string) => {
    const connection = connections.find(c => c.id === connectionId);
    if (connection) {
      setActiveConnection(connectionId, connection.defaultDatabase);
      toast.success(`Connected to ${connection.name} / ${connection.defaultDatabase}`);
    }
  };

  const handleContextMenu = (
    e: React.MouseEvent, 
    nodeId: string, 
    type: string, 
    connectionId: string, 
    database?: string, 
    table?: string
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      nodeId,
      type,
      connectionId,
      database: database || '',
      table,
    });
  };

  const handleSelectDatabase = (connectionId: string, database: string) => {
    setActiveConnection(connectionId, database);
    toast.success(`Connected to ${database}`);
    setContextMenu(null);
  };

  const handleImportData = () => {
    if (!contextMenu) return;
    openWizard({
      connectionId: contextMenu.connectionId,
      database: contextMenu.database,
      schema: 'main', // SQLite always uses 'main' schema internally
      table: contextMenu.table,
    });
    setContextMenu(null);
  };

  const handleGenerateSelect = () => {
    if (!contextMenu || !contextMenu.table) return;
    const tabId = createTab(contextMenu.connectionId, contextMenu.database);
    const sql = `SELECT * FROM "${contextMenu.table}" LIMIT 100;`;
    updateTabContent(tabId, sql);
    toast.success('SELECT query generated');
    setContextMenu(null);
  };

  const handleGenerateInsert = () => {
    if (!contextMenu || !contextMenu.table) return;
    const tabId = createTab(contextMenu.connectionId, contextMenu.database);
    const sql = `INSERT INTO "${contextMenu.table}" (column1, column2) VALUES (value1, value2);`;
    updateTabContent(tabId, sql);
    toast.success('INSERT template generated');
    setContextMenu(null);
  };

  const handleGenerateUpdate = () => {
    if (!contextMenu || !contextMenu.table) return;
    const tabId = createTab(contextMenu.connectionId, contextMenu.database);
    const sql = `UPDATE "${contextMenu.table}"\nSET column1 = value1\nWHERE condition;`;
    updateTabContent(tabId, sql);
    toast.success('UPDATE template generated');
    setContextMenu(null);
  };

  const handleGenerateDelete = () => {
    if (!contextMenu || !contextMenu.table) return;
    const tabId = createTab(contextMenu.connectionId, contextMenu.database);
    const sql = `DELETE FROM "${contextMenu.table}"\nWHERE condition;`;
    updateTabContent(tabId, sql);
    toast.warning('DELETE template generated - use WHERE clause carefully!');
    setContextMenu(null);
  };

  const handleViewStructure = async () => {
    if (!contextMenu || !contextMenu.table) return;
    try {
      const structure = await api.getTableStructure(
        contextMenu.connectionId,
        contextMenu.database,
        'main',
        contextMenu.table
      );
      const tabId = createTab(contextMenu.connectionId, contextMenu.database);
      const structureInfo = `-- Table: ${contextMenu.table}\n-- Database: ${contextMenu.database}\n\n${structure.columns.map(col => 
        `-- ${col.name}: ${col.dataType}${col.isNullable ? '' : ' NOT NULL'}${col.isPrimaryKey ? ' PRIMARY KEY' : ''}${col.defaultValue ? ` DEFAULT ${col.defaultValue}` : ''}`
      ).join('\n')}`;
      updateTabContent(tabId, structureInfo);
      toast.success('Table structure loaded');
    } catch (error) {
      toast.error('Failed to load table structure');
    }
    setContextMenu(null);
  };

  const handleRefreshTable = async () => {
    if (!contextMenu) return;
    toast.info('Refreshing...');
    // Refresh the node by toggling it
    const nodeId = contextMenu.nodeId;
    setNodeLoading(nodeId, false);
    // You'd implement proper refresh logic here
    setContextMenu(null);
  };

  const handleDropTable = async () => {
    if (!contextMenu || !contextMenu.table) return;
    
    const tableName = contextMenu.table;
    const confirmed = confirm(
      `⚠️ DROP TABLE: ${tableName}\n\n` +
      `This will permanently delete the table and ALL its data.\n` +
      `This action CANNOT be undone.\n\n` +
      `Are you sure you want to continue?`
    );
    
    if (!confirmed) {
      setContextMenu(null);
      return;
    }
    
    try {
      const sql = `DROP TABLE "${contextMenu.table}";`;
      await api.executeQuery({
        connectionId: contextMenu.connectionId,
        sql,
        database: contextMenu.database,
      });
      
      toast.success(`Table ${contextMenu.table} dropped successfully`);
      
      // Refresh the database node to reload tables
      const databaseNodeId = `${contextMenu.connectionId}:${contextMenu.database}`;
      setNodeLoading(databaseNodeId, true);
      
      try {
        const tables = await api.getTables(contextMenu.connectionId, contextMenu.database, 'main');
        const children = tables.map((table) => ({
          id: `${contextMenu.connectionId}:${contextMenu.database}:${table.name}`,
          type: table.type === 'view' ? ('view' as const) : ('table' as const),
          label: table.name,
          connectionId: contextMenu.connectionId,
          database: contextMenu.database,
          table: table.name,
          isExpanded: false,
          isLoading: false,
        }));
        
        // Update children - this will trigger re-render and clean up old nodes
        setNodeChildren(databaseNodeId, children);
      } finally {
        setNodeLoading(databaseNodeId, false);
      }
    } catch (error) {
      toast.error(`Failed to drop table: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    setContextMenu(null);
  };

  const handleDropDatabase = async () => {
    if (!contextMenu || !contextMenu.database) return;
    
    const dbName = contextMenu.database;
    const confirmed = confirm(
      `⚠️ DROP DATABASE: ${dbName}\n\n` +
      `This will permanently delete the entire database and ALL its tables, schemas, and data.\n` +
      `This action CANNOT be undone.\n\n` +
      `Type the database name to confirm: ${dbName}`
    );
    
    if (!confirmed) {
      setContextMenu(null);
      return;
    }
    
    // Additional confirmation
    const doubleCheck = confirm(
      `⚠️ FINAL WARNING\n\n` +
      `You are about to delete database: ${dbName}\n\n` +
      `Click OK to proceed with deletion.`
    );
    
    if (!doubleCheck) {
      setContextMenu(null);
      return;
    }
    
    try {
      // For SQLite, we don't need to terminate connections or connect to a system database
      // Just drop the database directly
      const sql = `DROP DATABASE "${dbName}";`;
      await api.executeQuery({
        connectionId: contextMenu.connectionId,
        sql,
        database: undefined,
      });
      
      toast.success(`Database ${dbName} dropped successfully`);
      
      // If the dropped database was selected, clear the active connection
      if (selectedDatabase === dbName) {
        // Don't try to switch to a system database - just refresh the databases list
      }
      
      // Force refresh the connection node to reload databases
      const connNodeId = contextMenu.connectionId;
      setNodeLoading(connNodeId, true);
      
      try {
        const databases = await api.getDatabases(contextMenu.connectionId);
        const children = databases.map((db) => ({
          id: `${contextMenu.connectionId}:${db.name}`,
          type: 'database' as const,
          label: db.name,
          connectionId: contextMenu.connectionId,
          database: db.name,
          isExpanded: false,
          isLoading: false,
        }));
        
        // Update children - this will trigger re-render
        setNodeChildren(connNodeId, children);
      } finally {
        setNodeLoading(connNodeId, false);
      }
    } catch (error) {
      toast.error(`Failed to drop database: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    setContextMenu(null);
  };

  const handleRefreshAll = async () => {
    toast.info('Refreshing database explorer...');
    
    // Refresh all expanded connection nodes
    for (const node of nodes) {
      if (node.type === 'connection' && expandedNodes.has(node.id)) {
        setNodeLoading(node.id, true);
        try {
          const databases = await api.getDatabases(node.connectionId);
          const children = databases.map((db) => ({
            id: `${node.connectionId}:${db.name}`,
            type: 'database' as const,
            label: db.name,
            connectionId: node.connectionId,
            database: db.name,
            isExpanded: false,
            isLoading: false,
          }));
          setNodeChildren(node.id, children);
        } catch (error) {
          console.error('Failed to refresh connection:', error);
        } finally {
          setNodeLoading(node.id, false);
        }
      }
    }
    
    toast.success('Database explorer refreshed');
  };

  const handleCreateDatabase = () => {
    if (!contextMenu || contextMenu.type !== 'connection') {
      return;
    }
    
    const connectionId = contextMenu.connectionId;
    setCreateDbDialog({ open: true, connectionId });
    setContextMenu(null);
  };
  
  const confirmCreateDatabase = async () => {
    if (!createDbDialog.connectionId || !newDbName.trim()) {
      return;
    }
    
    const connectionId = createDbDialog.connectionId;
    const trimmedName = newDbName.trim();
    
    // Validate database name (basic validation)
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(trimmedName)) {
      toast.error('Invalid database name. Use only letters, numbers, and underscores. Must start with a letter or underscore.');
      return;
    }
    
    // Close dialog and reset
    setCreateDbDialog({ open: false, connectionId: null });
    setNewDbName('');
    
    try {
      // For SQLite, we don't need to specify an existing database to create a new one
      const sql = `CREATE DATABASE "${trimmedName}";`;
      await api.executeQuery({
        connectionId: connectionId,
        sql,
        database: undefined,
      });
      
      toast.success(`Database ${trimmedName} created successfully`);
      
      // Refresh the connection node to reload databases
      const connNodeId = connectionId;
      setNodeLoading(connNodeId, true);
      
      try {
        const databases = await api.getDatabases(connectionId);
        const children = databases.map((db) => ({
          id: `${connectionId}:${db.name}`,
          type: 'database' as const,
          label: db.name,
          connectionId: connectionId,
          database: db.name,
          isExpanded: false,
          isLoading: false,
        }));
        
        setNodeChildren(connNodeId, children);
        
        // Expand the connection if not already expanded
        if (!expandedNodes.has(connNodeId)) {
          toggleNode(connNodeId);
        }
      } finally {
        setNodeLoading(connNodeId, false);
      }
    } catch (error) {
      toast.error(`Failed to create database: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleRefreshConnection = async () => {
    if (!contextMenu || contextMenu.type !== 'connection') return;
    
    const connNodeId = contextMenu.connectionId;
    setNodeLoading(connNodeId, true);
    
    try {
      const databases = await api.getDatabases(contextMenu.connectionId);
      const children = databases.map((db) => ({
        id: `${contextMenu.connectionId}:${db.name}`,
        type: 'database' as const,
        label: db.name,
        connectionId: contextMenu.connectionId,
        database: db.name,
        isExpanded: false,
        isLoading: false,
      }));
      
      setNodeChildren(connNodeId, children);
      toast.success('Connection refreshed');
    } catch (error) {
      toast.error('Failed to refresh connection');
    } finally {
      setNodeLoading(connNodeId, false);
    }
    
    setContextMenu(null);
  };

  const renderNode = (node: typeof nodes[0], level: number = 0): React.ReactNode => {
    const isExpanded = expandedNodes.has(node.id);
    const isLoading = loadingNodes.has(node.id);
    const hasChildren = node.type !== 'table' && node.type !== 'view';
    const isSelected = node.type === 'database' && 
                      node.connectionId === selectedConnectionId && 
                      node.database === selectedDatabase;
    const isConnectionSelected = node.type === 'connection' && node.connectionId === selectedConnectionId;

    const getIcon = () => {
      switch (node.type) {
        case 'connection':
          return <Database className="h-4 w-4" />;
        case 'database':
          return <Database className="h-4 w-4" />;
        case 'table':
        case 'view':
          return <Table className="h-4 w-4" />;
        default:
          return <Table className="h-4 w-4" />;
      }
    };

    return (
      <div key={node.id}>
        <div
          className={`flex items-center gap-1 py-1 px-2 hover:bg-accent cursor-pointer rounded-sm transition-colors ${
            isSelected ? 'bg-primary/20 border-l-4 border-primary font-semibold' : ''
          } ${
            isConnectionSelected && !isSelected ? 'bg-accent/50' : ''
          }`}
          style={{ paddingLeft: `${level * 12 + 8}px` }}
          onClick={() => {
            // Single click - expand/collapse only
            if (hasChildren) {
              handleToggle(node.id, node.type, node.connectionId, node.database);
            }
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            if (node.type === 'connection') {
              // Double-click connection to select its default database
              handleConnectionDoubleClick(node.connectionId);
            } else if (node.type === 'database') {
              // Double-click database to select it
              handleDatabaseClick(node.connectionId, node.database || '');
            }
          }}
          onContextMenu={(e) => {
            if (node.type === 'table' || node.type === 'database' || node.type === 'connection' || node.type === 'view') {
              handleContextMenu(e, node.id, node.type, node.connectionId, node.database, node.type === 'table' || node.type === 'view' ? node.label : undefined);
            }
          }}
        >
          {hasChildren && (
            <>
              {isLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : isExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </>
          )}
          {!hasChildren && <span className="w-3" />}
          {getIcon()}
          <span className={`text-sm truncate flex-1 ${isSelected ? 'text-primary' : ''}`}>
            {node.label}
          </span>
          {isSelected && <CheckCircle2 className="h-4 w-4 text-primary" />}
        </div>

        {isExpanded && node.children && node.children.map((child) => renderNode(child, level + 1))}
      </div>
    );
  };

  return (
    <div className="p-2 relative flex flex-col h-full">
      <div className="flex items-center justify-between mb-2 px-2">
        <h2 className="text-xs font-semibold uppercase text-muted-foreground">Databases</h2>
        <button
          onClick={handleRefreshAll}
          className="p-1 hover:bg-accent rounded-sm transition-colors"
          title="Refresh all"
        >
          <RefreshCw className="h-4 w-4 text-muted-foreground hover:text-foreground" />
        </button>
      </div>
      
      {/* Selected Database Indicator */}
      {selectedConnectionId && selectedDatabase && (
        <div className="mb-2 px-2 py-2 bg-primary/10 border-l-4 border-primary rounded-r-md">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-primary truncate">
                {connections.find(c => c.id === selectedConnectionId)?.name}
              </p>
              <p className="text-xs text-muted-foreground truncate">{selectedDatabase}</p>
            </div>
          </div>
        </div>
      )}

      {nodes.length === 0 ? (
        <p className="text-sm text-muted-foreground px-2">No connections</p>
      ) : (
        <div className="space-y-0.5 flex-1 overflow-y-auto">{nodes.map((node) => renderNode(node))}</div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed bg-card border-2 border-primary rounded-md shadow-2xl py-1 z-[9999] min-w-[200px]"
          style={{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.type === 'connection' && (
            <>
              <button
                className="w-full px-3 py-2 text-sm text-left hover:bg-accent flex items-center gap-2 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCreateDatabase();
                }}
              >
                <Plus className="h-4 w-4" />
                Create Database...
              </button>
              <button
                className="w-full px-3 py-2 text-sm text-left hover:bg-accent flex items-center gap-2 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRefreshConnection();
                }}
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
            </>
          )}

          {contextMenu.type === 'database' && (
            <>
              <button
                className="w-full px-3 py-2 text-sm text-left hover:bg-accent flex items-center gap-2 cursor-pointer"
                onClick={() => handleSelectDatabase(contextMenu.connectionId, contextMenu.database)}
              >
                <Check className="h-4 w-4" />
                Select Database
              </button>
              <div className="h-px bg-border my-1" />
              <button
                className="w-full px-3 py-2 text-sm text-left hover:bg-accent flex items-center gap-2 cursor-pointer"
                onClick={() => {
                  setBackupManager({
                    open: true,
                    connectionId: contextMenu.connectionId,
                    database: contextMenu.database,
                  });
                  setContextMenu(null);
                }}
              >
                <Database className="h-4 w-4" />
                Backup & Restore...
              </button>
              <button
                className="w-full px-3 py-2 text-sm text-left hover:bg-accent flex items-center gap-2 cursor-pointer"
                onClick={handleImportData}
              >
                <FileUp className="h-4 w-4" />
                Import Data...
              </button>
              <div className="h-px bg-border my-1" />
              <button
                className="w-full px-3 py-2 text-sm text-left hover:bg-destructive/20 flex items-center gap-2 cursor-pointer text-destructive font-semibold"
                onClick={handleDropDatabase}
              >
                <Trash2 className="h-4 w-4" />
                Drop Database
              </button>
            </>
          )}

          {contextMenu.type === 'table' && (
            <>
              <button
                className="w-full px-3 py-2 text-sm text-left hover:bg-accent flex items-center gap-2 cursor-pointer"
                onClick={handleGenerateSelect}
              >
                <Code className="h-4 w-4" />
                SELECT * FROM
              </button>
              <button
                className="w-full px-3 py-2 text-sm text-left hover:bg-accent flex items-center gap-2 cursor-pointer"
                onClick={handleGenerateInsert}
              >
                <Copy className="h-4 w-4" />
                Generate INSERT
              </button>
              <button
                className="w-full px-3 py-2 text-sm text-left hover:bg-accent flex items-center gap-2 cursor-pointer"
                onClick={handleGenerateUpdate}
              >
                <Edit2 className="h-4 w-4" />
                Generate UPDATE
              </button>
              <button
                className="w-full px-3 py-2 text-sm text-left hover:bg-accent flex items-center gap-2 cursor-pointer text-destructive"
                onClick={handleGenerateDelete}
              >
                <Trash2 className="h-4 w-4" />
                Generate DELETE
              </button>
              <div className="h-px bg-border my-1" />
              <button
                className="w-full px-3 py-2 text-sm text-left hover:bg-accent flex items-center gap-2 cursor-pointer"
                onClick={handleViewStructure}
              >
                <Eye className="h-4 w-4" />
                View Structure
              </button>
              <button
                className="w-full px-3 py-2 text-sm text-left hover:bg-accent flex items-center gap-2 cursor-pointer"
                onClick={handleImportData}
              >
                <FileUp className="h-4 w-4" />
                Import Data...
              </button>
              <button
                className="w-full px-3 py-2 text-sm text-left hover:bg-accent flex items-center gap-2 cursor-pointer"
                onClick={handleRefreshTable}
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
              <div className="h-px bg-border my-1" />
              <button
                className="w-full px-3 py-2 text-sm text-left hover:bg-destructive/20 flex items-center gap-2 cursor-pointer text-destructive font-semibold"
                onClick={handleDropTable}
              >
                <Trash2 className="h-4 w-4" />
                Drop Table
              </button>
            </>
          )}

          {contextMenu.type !== 'table' && contextMenu.type !== 'database' && contextMenu.type !== 'connection' && (
            <>
              <button
                className="w-full px-3 py-2 text-sm text-left hover:bg-accent flex items-center gap-2 cursor-pointer"
                onClick={handleImportData}
              >
                <FileUp className="h-4 w-4" />
                Import Data...
              </button>

              <button
                className="w-full px-3 py-2 text-sm text-left hover:bg-accent flex items-center gap-2 cursor-pointer"
                onClick={handleRefreshTable}
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
            </>
          )}
        </div>
      )}
      
      {/* Create Database Dialog */}
      <Dialog open={createDbDialog.open} onOpenChange={(open) => {
        setCreateDbDialog({ open, connectionId: createDbDialog.connectionId });
        if (!open) setNewDbName('');
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Database</DialogTitle>
            <DialogDescription>
              Enter a name for the new database. Use only letters, numbers, and underscores. Must start with a letter or underscore.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="dbname">Database Name</Label>
            <Input
              id="dbname"
              value={newDbName}
              onChange={(e) => setNewDbName(e.target.value)}
              placeholder="my_database"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  confirmCreateDatabase();
                }
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateDbDialog({ open: false, connectionId: null });
                setNewDbName('');
              }}
            >
              Cancel
            </Button>
            <Button onClick={confirmCreateDatabase}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Backup Manager */}
      {backupManager && (
        <BackupManager
          open={backupManager.open}
          onOpenChange={(open) => {
            if (!open) setBackupManager(null);
          }}
          connectionId={backupManager.connectionId}
          database={backupManager.database}
        />
      )}
    </div>
  );
}
