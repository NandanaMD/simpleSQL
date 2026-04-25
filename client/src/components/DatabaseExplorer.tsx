import { useEffect, useState } from 'react';
import { useConnectionStore } from '../stores/connectionStore';
import { useExplorerStore } from '../stores/explorerStore';
import { useImportStore } from '../stores/importStore';
import { useEditorStore } from '../stores/editorStore';
import { BackupManager } from './BackupManager';
import * as api from '../lib/api';
import { ChevronRight, ChevronDown, Database, Table, Loader2, Check, FileUp, Code, Trash2, Edit2, Copy, RefreshCw, Eye, Key, Lock, Unlock, Columns3, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import selectedIcon from '../../../assets/icons/selected.svg';
import databaseSelectedIcon from '../../../assets/icons/database_selected.svg';
import databaseNotSelectedIcon from '../../../assets/icons/database_not_selected.svg';

export function DatabaseExplorer() {
  const { connections, selectedConnectionId, selectedDatabase, setActiveConnection } = useConnectionStore();
  const { nodes, expandedNodes, loadingNodes, addConnection, toggleNode, setNodeChildren, setNodeLoading, clearNodes } = useExplorerStore();
  const { openWizard } = useImportStore();
  const { createTab, updateTabContent } = useEditorStore();
  const [contextMenu, setContextMenu] = useState<{ 
    x: number; 
    y: number; 
    nodeId: string; 
    connectionId: string; 
    database: string; 
    table?: string;
    column?: string;
    columnMeta?: {
      dataType: string;
      isPrimaryKey: boolean;
      isNullable: boolean;
      isUnique: boolean;
    };
    type: string 
  } | null>(null);
  const [backupManager, setBackupManager] = useState<{ open: boolean; connectionId: string; database: string } | null>(null);
  const [showCreateDb, setShowCreateDb] = useState(false);
  const [newDbName, setNewDbName] = useState('');
  const [isCreatingDb, setIsCreatingDb] = useState(false);

  const loadDatabasesForConnection = async (connectionId: string) => {
    setNodeLoading(connectionId, true);
    try {
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
      setNodeChildren(connectionId, children);
    } finally {
      setNodeLoading(connectionId, false);
    }
  };

  useEffect(() => {
    if (!selectedConnectionId) {
      clearNodes();
      return;
    }

    const activeConnection = connections.find((conn) => conn.id === selectedConnectionId);
    if (!activeConnection) {
      clearNodes();
      return;
    }

    clearNodes();
    addConnection(activeConnection.id, activeConnection.name);
    loadDatabasesForConnection(activeConnection.id).catch((error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to load databases');
    });
  }, [connections, selectedConnectionId, clearNodes, addConnection]);

  useEffect(() => {
    // Close context menu when clicking anywhere
    const handleClick = () => setContextMenu(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const handleToggle = async (nodeId: string, type: string, connectionId: string, database?: string, table?: string) => {
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
        } else if ((type === 'table' || type === 'view') && database && table) {
          // Load columns for table
          const structure = await api.getTableStructure(connectionId, database, 'main', table);
          const children = structure.columns.map((col) => ({
            id: `${connectionId}:${database}:${table}:${col.name}`,
            type: 'column' as const,
            label: col.name,
            connectionId,
            database,
            table,
            column: col.name,
            columnMeta: {
              dataType: col.dataType,
              isPrimaryKey: col.isPrimaryKey,
              isNullable: col.isNullable,
              isUnique: col.isUnique,
            },
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

  const handleContextMenu = (
    e: React.MouseEvent, 
    node: typeof nodes[0]
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      nodeId: node.id,
      type: node.type,
      connectionId: node.connectionId,
      database: node.database || '',
      table: node.table,
      column: node.column,
      columnMeta: node.columnMeta,
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
    if (!selectedConnectionId) {
      toast.error('No active connection');
      return;
    }

    toast.info('Refreshing databases...');
    try {
      await loadDatabasesForConnection(selectedConnectionId);
      toast.success('Databases refreshed');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to refresh databases');
    }
  };

  const handleCreateDatabase = async () => {
    if (!selectedConnectionId) {
      toast.error('No active connection');
      return;
    }

    const trimmedName = newDbName.trim();
    if (!trimmedName) {
      toast.error('Database name cannot be empty');
      return;
    }

    // Validate name: alphanumeric, underscores, hyphens only
    if (!/^[a-zA-Z0-9_-]+$/.test(trimmedName)) {
      toast.error('Database name can only contain letters, numbers, underscores, and hyphens');
      return;
    }

    setIsCreatingDb(true);
    try {
      await api.executeQuery({
        connectionId: selectedConnectionId,
        sql: `CREATE DATABASE "${trimmedName}";`,
      });

      toast.success(`Database "${trimmedName}" created successfully`);

      // Refresh the database list in the explorer
      await loadDatabasesForConnection(selectedConnectionId);

      // Auto-select the newly created database
      setActiveConnection(selectedConnectionId, trimmedName);

      // Reset the form
      setNewDbName('');
      setShowCreateDb(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create database');
    } finally {
      setIsCreatingDb(false);
    }
  };

  const handleCopyColumnName = () => {
    if (!contextMenu || !contextMenu.column) return;
    
    navigator.clipboard.writeText(contextMenu.column);
    toast.success(`Copied "${contextMenu.column}" to clipboard`);
    setContextMenu(null);
  };

  const handleCopyColumnSelect = () => {
    if (!contextMenu || !contextMenu.column || !contextMenu.table) return;
    
    const sql = `SELECT "${contextMenu.column}" FROM "${contextMenu.table}";`;
    navigator.clipboard.writeText(sql);
    toast.success('SELECT query copied to clipboard');
    setContextMenu(null);
  };

  const handleViewColumnDetails = () => {
    if (!contextMenu || !contextMenu.column || !contextMenu.columnMeta) return;
    
    const tabId = createTab(contextMenu.connectionId, contextMenu.database);
    const details = [
      `-- Column: ${contextMenu.column}`,
      `-- Table: ${contextMenu.table}`,
      `-- Database: ${contextMenu.database}`,
      ``,
      `-- Data Type: ${contextMenu.columnMeta.dataType}`,
      `-- Nullable: ${contextMenu.columnMeta.isNullable ? 'YES' : 'NO'}`,
      `-- Primary Key: ${contextMenu.columnMeta.isPrimaryKey ? 'YES' : 'NO'}`,
      `-- Unique: ${contextMenu.columnMeta.isUnique ? 'YES' : 'NO'}`,
    ].join('\n');
    
    updateTabContent(tabId, details);
    toast.success('Column details loaded');
    setContextMenu(null);
  };

  const renderNode = (node: typeof nodes[0], level: number = 0): React.ReactNode => {
    const isExpanded = expandedNodes.has(node.id);
    const isLoading = loadingNodes.has(node.id);
    const hasChildren = node.type !== 'column'; // All types except column can have children
    const isSelected = node.type === 'database' && 
                      node.connectionId === selectedConnectionId && 
                      node.database === selectedDatabase;
    const getIcon = () => {
      switch (node.type) {
        case 'database':
          return (
            <img
              src={isSelected ? databaseSelectedIcon : databaseNotSelectedIcon}
              alt=""
              aria-hidden="true"
              className="h-4 w-4"
            />
          );
        case 'table':
        case 'view':
          return <Table className="h-4 w-4" />;
        case 'column':
          // Choose icon based on column properties
          if (node.columnMeta?.isPrimaryKey) {
            return <Key className="h-3.5 w-3.5 text-amber-500" />;
          } else if (node.columnMeta?.isUnique) {
            return <Lock className="h-3.5 w-3.5 text-blue-500" />;
          } else if (!node.columnMeta?.isNullable) {
            return <Columns3 className="h-3.5 w-3.5 text-green-600" />;
          } else {
            return <Unlock className="h-3.5 w-3.5 text-muted-foreground" />;
          }
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
            node.type === 'column' ? 'text-xs text-muted-foreground' : 'text-sm'
          }`}
          style={{ paddingLeft: `${level * 12 + 8}px` }}
          onClick={() => {
            // Single click - expand/collapse only
            if (hasChildren) {
              handleToggle(node.id, node.type, node.connectionId, node.database, node.table);
            }
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            if (node.type === 'database') {
              // Double-click database to select it
              handleDatabaseClick(node.connectionId, node.database || '');
            }
          }}
          onContextMenu={(e) => {
            if (node.type === 'table' || node.type === 'database' || node.type === 'view' || node.type === 'column') {
              handleContextMenu(e, node);
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
          <span className={`truncate flex-1 ${isSelected ? 'text-primary' : ''} ${node.type === 'column' ? 'font-mono' : ''}`}>
            {node.label}
            {node.type === 'column' && node.columnMeta && (
              <span className="ml-1 text-muted-foreground/70">({node.columnMeta.dataType})</span>
            )}
          </span>
          {isSelected && <img src={selectedIcon} alt="" aria-hidden="true" className="h-4 w-4 text-primary" />}
        </div>

        {isExpanded && node.children && node.children.map((child) => renderNode(child, level + 1))}
      </div>
    );
  };

  const activeConnectionNode = selectedConnectionId
    ? nodes.find((node) => node.id === selectedConnectionId)
    : undefined;
  const visibleNodes = activeConnectionNode?.children ?? [];

  return (
    <div className="p-2 relative flex flex-col h-full">
      <div className="flex items-center justify-between mb-2 px-2">
        <h2 className="text-xs font-semibold uppercase text-muted-foreground">Databases</h2>
        <div className="flex items-center gap-0.5">
          {selectedConnectionId && (
            <button
              onClick={() => { setShowCreateDb(!showCreateDb); setNewDbName(''); }}
              className="p-1 hover:bg-accent rounded-sm transition-colors"
              title="Create new database"
            >
              {showCreateDb ? (
                <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
              ) : (
                <Plus className="h-4 w-4 text-muted-foreground hover:text-foreground" />
              )}
            </button>
          )}
          <button
            onClick={handleRefreshAll}
            className="p-1 hover:bg-accent rounded-sm transition-colors"
            title="Refresh all"
          >
            <RefreshCw className="h-4 w-4 text-muted-foreground hover:text-foreground" />
          </button>
        </div>
      </div>

      {/* Create Database Inline Form */}
      {showCreateDb && selectedConnectionId && (
        <div className="mb-2 px-2 py-2 bg-accent/50 rounded-md border border-border">
          <p className="text-xs font-semibold mb-1.5 text-foreground">New Database</p>
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={newDbName}
              onChange={(e) => setNewDbName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleCreateDatabase();
                } else if (e.key === 'Escape') {
                  setShowCreateDb(false);
                  setNewDbName('');
                }
              }}
              placeholder="e.g. sales_db"
              autoFocus
              disabled={isCreatingDb}
              className="flex-1 min-w-0 px-2 py-1 text-sm bg-background border border-border rounded-sm focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50"
            />
            <button
              onClick={() => void handleCreateDatabase()}
              disabled={isCreatingDb || !newDbName.trim()}
              className="px-2 py-1 text-xs font-medium bg-primary text-primary-foreground rounded-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 transition-colors"
            >
              {isCreatingDb ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Plus className="h-3 w-3" />
              )}
              Create
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">Letters, numbers, underscores, hyphens only</p>
        </div>
      )}
      
      {/* Selected Database Indicator */}
      {selectedConnectionId && selectedDatabase && (
        <div className="mb-2 px-2 py-2 bg-primary/10 border-l-4 border-primary rounded-r-md">
          <div className="flex items-center gap-2">
            <img src={selectedIcon} alt="" aria-hidden="true" className="h-4 w-4 text-primary" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-primary truncate">{selectedDatabase}</p>
            </div>
          </div>
        </div>
      )}

      {!selectedConnectionId ? (
        <p className="text-sm text-muted-foreground px-2">No active connection selected</p>
      ) : visibleNodes.length === 0 ? (
        <p className="text-sm text-muted-foreground px-2">No databases found</p>
      ) : (
        <div className="space-y-0.5 flex-1 overflow-y-auto">{visibleNodes.map((node) => renderNode(node))}</div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed bg-card border-2 border-primary rounded-md shadow-2xl py-1 z-[9999] min-w-[200px]"
          style={{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }}
          onClick={(e) => e.stopPropagation()}
        >
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
                  setShowCreateDb(true);
                  setNewDbName('');
                  setContextMenu(null);
                }}
              >
                <Plus className="h-4 w-4" />
                Create Database...
              </button>
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

          {contextMenu.type === 'column' && (
            <>
              <button
                className="w-full px-3 py-2 text-sm text-left hover:bg-accent flex items-center gap-2 cursor-pointer"
                onClick={handleCopyColumnName}
              >
                <Copy className="h-4 w-4" />
                Copy Column Name
              </button>
              <button
                className="w-full px-3 py-2 text-sm text-left hover:bg-accent flex items-center gap-2 cursor-pointer"
                onClick={handleCopyColumnSelect}
              >
                <Code className="h-4 w-4" />
                Copy SELECT Query
              </button>
              <button
                className="w-full px-3 py-2 text-sm text-left hover:bg-accent flex items-center gap-2 cursor-pointer"
                onClick={handleViewColumnDetails}
              >
                <Eye className="h-4 w-4" />
                View Details
              </button>
            </>
          )}

          {contextMenu.type === 'view' && (
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
