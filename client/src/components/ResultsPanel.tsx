import React, { useMemo, useState, useRef, useCallback } from 'react';
import { useEditorStore } from '../stores/editorStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useConnectionStore } from '../stores/connectionStore';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
  SortingState,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Download, Search, ChevronDown, AlertCircle } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';

// ========================================
// PERFORMANCE OPTIMIZATIONS
// ========================================

// Cell metadata types for pre-computed formatting hints
interface CellMeta {
  type: 'null' | 'boolean' | 'number' | 'string' | 'date' | 'url' | 'long-string' | 'object';
  needsTruncation: boolean;
  isUrl: boolean;
  isDate: boolean;
}

// Date regex (compiled once)
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}/;
const URL_REGEX = /^https?:\/\//;

/**
 * Pre-compute cell formatting metadata to avoid repeated regex/type checks
 * This function runs once per result set, not once per cell render
 */
function computeCellMeta(value: unknown): CellMeta {
  if (value === null || value === undefined) {
    return { type: 'null', needsTruncation: false, isUrl: false, isDate: false };
  }
  
  if (typeof value === 'boolean') {
    return { type: 'boolean', needsTruncation: false, isUrl: false, isDate: false };
  }
  
  if (typeof value === 'number') {
    return { type: 'number', needsTruncation: false, isUrl: false, isDate: false };
  }
  
  if (typeof value === 'string') {
    const isDate = DATE_REGEX.test(value);
    const isUrl = URL_REGEX.test(value);
    const needsTruncation = value.length > 100;
    
    if (isDate) {
      return { type: 'date', needsTruncation: false, isUrl: false, isDate: true };
    }
    if (isUrl) {
      return { type: 'url', needsTruncation: false, isUrl: true, isDate: false };
    }
    if (needsTruncation) {
      return { type: 'long-string', needsTruncation: true, isUrl: false, isDate: false };
    }
    
    return { type: 'string', needsTruncation: false, isUrl: false, isDate: false };
  }
  
  if (typeof value === 'object') {
    return { type: 'object', needsTruncation: false, isUrl: false, isDate: false };
  }
  
  return { type: 'string', needsTruncation: false, isUrl: false, isDate: false };
}

/**
 * Memoized cell renderer - prevents re-rendering cells that haven't changed
 */
const CellContent = React.memo<{ value: unknown; meta: CellMeta; formatSettings: any }>(
  ({ value, meta, formatSettings }) => {
    switch (meta.type) {
      case 'null':
        return (
          <span className="text-orange-500 italic text-xs font-semibold bg-orange-50 dark:bg-orange-950/30 px-1 rounded">
            {formatSettings.nullDisplay}
          </span>
        );
      
      case 'boolean':
        return (
          <span className={`text-xs font-semibold ${(value as boolean) ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {(value as boolean) ? formatSettings.booleanDisplay.true : formatSettings.booleanDisplay.false}
          </span>
        );
      
      case 'number':
        const formatted = Number.isInteger(value as number) 
          ? value 
          : (value as number).toFixed(formatSettings.numberPrecision);
        return <span className="text-xs font-mono text-blue-600 dark:text-blue-400">{String(formatted)}</span>;
      
      case 'date':
        return <span className="text-xs font-mono text-purple-600 dark:text-purple-400">{value as string}</span>;
      
      case 'url':
        return (
          <a 
            href={value as string} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            {value as string}
          </a>
        );
      
      case 'long-string':
        return (
          <span className="text-xs" title={value as string}>
            {(value as string).substring(0, 100)}...
          </span>
        );
      
      case 'object':
        return <span className="text-xs font-mono">{JSON.stringify(value)}</span>;
      
      default:
        return <span className="text-xs">{String(value)}</span>;
    }
  },
  (prevProps, nextProps) => {
    // Only re-render if value actually changed
    return prevProps.value === nextProps.value && prevProps.meta === nextProps.meta;
  }
);

CellContent.displayName = 'CellContent';

function truncateQuery(sql: string, maxLength = 140) {
  const normalized = sql.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength)}...`;
}

export function ResultsPanel() {
  const { tabs, activeTabId, queryError, isExecuting } = useEditorStore();
  const { connections } = useConnectionStore();
  const { format: formatSettings } = useSettingsStore();
  const [globalFilter, setGlobalFilter] = useState('');

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const activeTab = tabs.find(tab => tab.id === activeTabId);
  const hasResult = activeTab?.resultRows && activeTab.resultRows.length >= 0;
  const executedConnectionName = activeTab?.lastExecutionConnectionId
    ? connections.find((connection) => connection.id === activeTab.lastExecutionConnectionId)?.name
    : undefined;
  const executedQueryPreview = activeTab?.lastExecutedSql
    ? truncateQuery(activeTab.lastExecutedSql)
    : undefined;

  const exportToCSV = () => {
    if (!activeTab?.resultRows || !activeTab.resultColumns) return;
    
    try {
      const headers = activeTab.resultColumns.map((f: any) => f.name).join(',');
      const rows = activeTab.resultRows.map((row: any) => 
        activeTab.resultColumns!.map((field: any) => {
          const value = row[field.name];
          if (value === null) return '';
          if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }).join(',')
      );
      const csv = [headers, ...rows].join('\n');

      downloadFile(csv, `query_results_${new Date().getTime()}.csv`, 'text/csv');
    } catch (error) {
      // Silent fail
    }
  };

  const exportToJSON = () => {
    if (!activeTab?.resultRows || !activeTab.resultColumns) return;
    
    try {
      const json = JSON.stringify(activeTab.resultRows, null, 2);
      downloadFile(json, `query_results_${new Date().getTime()}.json`, 'application/json');
    } catch (error) {
      // Silent fail
    }
  };

  const exportToSQL = () => {
    if (!activeTab?.resultRows || !activeTab.resultColumns) return;
    
    try {
      const tableName = 'exported_data'; // Could be made configurable
      const columns = activeTab.resultColumns.map((f: any) => f.name);
      
      let sql = `-- Exported data from SimpleSQL\n-- ${new Date().toISOString()}\n\n`;
      
      activeTab.resultRows.forEach((row: any) => {
        const values = columns.map((col) => {
          const value = row[col];
          if (value === null || value === undefined) return 'NULL';
          if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
          if (typeof value === 'boolean') return value ? '1' : '0';
          return value;
        });
        
        sql += `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${values.join(', ')});\n`;
      });
      
      downloadFile(sql, `query_results_${new Date().getTime()}.sql`, 'application/sql');
    } catch (error) {
      // Silent fail
    }
  };

  const exportToMarkdown = () => {
    if (!activeTab?.resultRows || !activeTab.resultColumns) return;
    
    try {
      const columns = activeTab.resultColumns.map((f: any) => f.name);
      
      // Header row
      let markdown = `| ${columns.join(' | ')} |\n`;
      // Separator row
      markdown += `| ${columns.map(() => '---').join(' | ')} |\n`;
      // Data rows
      activeTab.resultRows.forEach((row: any) => {
        const values = columns.map((col) => {
          const value = row[col];
          if (value === null || value === undefined) return '';
          return String(value).replace(/\|/g, '\\|').replace(/\n/g, ' ');
        });
        markdown += `| ${values.join(' | ')} |\n`;
      });
      
      downloadFile(markdown, `query_results_${new Date().getTime()}.md`, 'text/markdown');
    } catch (error) {
      // Silent fail
    }
  };

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const [showExportMenu, setShowExportMenu] = useState(false);

  return (
    <div className="flex flex-col h-full bg-background border-t border-border">
      {/* Header */}
      <div className="border-b border-border px-3 py-2 bg-card">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold">
              Results {activeTab ? `— ${activeTab.title}` : ''}
            </div>
            {activeTab?.executionTimestamp && (
              <div className="text-[11px] text-muted-foreground truncate">
                {activeTab.resultCommand || 'QUERY'} • {activeTab.resultRowCount ?? 0} row{(activeTab.resultRowCount ?? 0) !== 1 ? 's' : ''} • {activeTab.executionTime ?? 0}ms • {formatTime(activeTab.executionTimestamp)}
                {executedConnectionName ? ` • ${executedConnectionName}` : ''}
                {activeTab.lastExecutionDatabase ? ` / ${activeTab.lastExecutionDatabase}` : ''}
                {activeTab.lastExecutionMode ? ` • ${activeTab.lastExecutionMode.toUpperCase()}` : ''}
              </div>
            )}
          </div>
          {hasResult && (
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-2 h-3 w-3 text-muted-foreground" />
                <Input
                  placeholder="Filter results..."
                  value={globalFilter}
                  onChange={(e) => setGlobalFilter(e.target.value)}
                  className="h-7 text-xs pl-7 w-48"
                />
              </div>
              <div className="relative">
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={() => setShowExportMenu(!showExportMenu)} 
                  className="h-7 text-xs"
                >
                  <Download className="h-3 w-3 mr-1" />
                  Export
                  <ChevronDown className="h-3 w-3 ml-1" />
                </Button>
                {showExportMenu && (
                  <div className="absolute right-0 top-8 bg-card border rounded-lg shadow-lg py-1 z-50 min-w-[150px]">
                    <button
                      className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent"
                      onClick={() => {
                        exportToCSV();
                        setShowExportMenu(false);
                      }}
                    >
                      Export as CSV
                    </button>
                    <button
                      className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent"
                      onClick={() => {
                        exportToJSON();
                        setShowExportMenu(false);
                      }}
                    >
                      Export as JSON
                    </button>
                    <button
                      className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent"
                      onClick={() => {
                        exportToSQL();
                        setShowExportMenu(false);
                      }}
                    >
                      Export as SQL INSERT
                    </button>
                    <button
                      className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent"
                      onClick={() => {
                        exportToMarkdown();
                        setShowExportMenu(false);
                      }}
                    >
                      Export as Markdown
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        {hasResult && executedQueryPreview && (
          <div className="mt-1 text-[11px] text-muted-foreground truncate" title={activeTab?.lastExecutedSql}>
            From query: {executedQueryPreview}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {hasResult ? (
          <div className="flex-1 w-full h-full overflow-hidden">
            <ResultGrid 
              rows={activeTab.resultRows!}
              columns={activeTab.resultColumns!}
              globalFilter={globalFilter} 
              formatSettings={formatSettings} 
            />
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            <OutputLog 
              activeTab={activeTab}
              queryError={queryError} 
              isExecuting={isExecuting} 
              formatTime={formatTime}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// Result Grid Component with Virtualization
function ResultGrid({ rows, columns, globalFilter, formatSettings }: { rows: any[]; columns: any[]; globalFilter: string; formatSettings: any }) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Pre-compute cell metadata once when result changes
  const rowsWithMeta = useMemo(() => {
    if (!rows) return [];
    
    return rows.map((row: Record<string, unknown>) => {
      const meta: Record<string, CellMeta> = {};
      for (const [key, value] of Object.entries(row)) {
        meta[key] = computeCellMeta(value);
      }
      return { ...row, _meta: meta };
    });
  }, [rows]);

  const tableColumns = useMemo(() => {
    if (!columns || !rows || rows.length === 0) return [];

    const columnHelper = createColumnHelper<Record<string, unknown>>();

    const rowNumberColumn = columnHelper.display({
      id: '_rowNumber',
      header: '#',
      cell: (info) => (
        <span className="text-muted-foreground font-mono text-xs">
          {info.row.index + 1}
        </span>
      ),
      size: 50,
    });

    const dataColumns = columns.map((field: any) =>
      columnHelper.accessor(field.name, {
        header: field.name,
        cell: (info) => {
          const value = info.getValue();
          const row = info.row.original as any;
          const meta = row._meta?.[field.name] || computeCellMeta(value);
          
          return <CellContent value={value} meta={meta} formatSettings={formatSettings} />;
        },
        size: 150,
      })
    );

    return [rowNumberColumn, ...dataColumns];
  }, [columns, rows, formatSettings]);

  const table = useReactTable({
    data: rowsWithMeta,
    columns: tableColumns,
    state: {
      sorting,
      globalFilter,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: () => {},
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: 'includesString',
  });

  const { rows: tableRows } = table.getRowModel();

  // Set up virtual scrolling
  const rowVirtualizer = useVirtualizer({
    count: tableRows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: useCallback(() => 35, []), // estimated row height in pixels
    overscan: 10, // render 10 extra rows above/below viewport for smooth scrolling
  });

  if (!rows || rows.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground text-xs bg-card">
        No rows returned
      </div>
    );
  }

  const virtualItems = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();
  const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0;
  const paddingBottom = virtualItems.length > 0 ? totalSize - virtualItems[virtualItems.length - 1].end : 0;

  return (
    <div className="h-full flex flex-col bg-card">
      {/* Info bar showing row count */}
      <div className="px-3 py-1 text-xs text-muted-foreground border-b border-border bg-muted/30">
        Showing {tableRows.length} row{tableRows.length !== 1 ? 's' : ''} 
        {globalFilter && ` (filtered from ${rows.length} total)`}
      </div>
      
      <div ref={tableContainerRef} className="flex-1 overflow-auto">
        <table className="w-full border-collapse" style={{ display: 'grid' }}>
          <thead className="sticky top-0 bg-muted z-10" style={{ display: 'grid', position: 'sticky' }}>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} style={{ display: 'flex', width: '100%' }}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    style={{ 
                      display: 'flex', 
                      width: header.id === '_rowNumber' ? '60px' : `${header.getSize()}px`,
                      minWidth: header.id === '_rowNumber' ? '60px' : '100px',
                    }}
                    className={`px-4 py-2 text-left text-xs font-medium border-b border-border ${
                      header.id !== '_rowNumber' ? 'cursor-pointer hover:bg-muted/60' : ''
                    } ${header.id === '_rowNumber' ? 'bg-muted/50' : ''}`}
                    onClick={header.id !== '_rowNumber' ? header.column.getToggleSortingHandler() : undefined}
                  >
                    <div className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.id !== '_rowNumber' && (
                        <span className="text-muted-foreground text-xs">
                          {{
                            asc: '↑',
                            desc: '↓',
                          }[header.column.getIsSorted() as string] ?? ''}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody style={{ display: 'grid', height: `${totalSize}px`, position: 'relative' }}>
            {paddingTop > 0 && (
              <tr style={{ display: 'grid', height: `${paddingTop}px` }} />
            )}
            {virtualItems.map((virtualRow) => {
              const row = tableRows[virtualRow.index];
              return (
                <tr
                  key={row.id}
                  style={{
                    display: 'flex',
                    position: 'absolute',
                    transform: `translateY(${virtualRow.start}px)`,
                    width: '100%',
                    height: `${virtualRow.size}px`,
                  }}
                  className={`border-b border-border hover:bg-accent/20 ${
                    virtualRow.index % 2 === 0 ? '' : 'bg-muted/5'
                  }`}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      style={{ 
                        display: 'flex',
                        alignItems: 'center',
                        width: cell.column.id === '_rowNumber' ? '60px' : `${cell.column.getSize()}px`,
                        minWidth: cell.column.id === '_rowNumber' ? '60px' : '100px',
                      }}
                      className={`px-4 py-2 ${
                        cell.column.id === '_rowNumber' ? 'bg-muted/10 justify-center' : ''
                      }`}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              );
            })}
            {paddingBottom > 0 && (
              <tr style={{ display: 'grid', height: `${paddingBottom}px` }} />
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function parseError(error: string) {
  if (!error) return { title: 'Unknown Error', details: '' };
  
  // Example SQLite or Postgres: "syntax error at or near 'foo'"
  const syntaxMatch = error.match(/(syntax error at or near) (['"].*?['"])/i) || 
                      error.match(/(near) (['"].*?['"]): (syntax error)/i);
  
  if (syntaxMatch) {
    return {
      title: 'Syntax Error',
      details: error,
      highlight: syntaxMatch[2]
    };
  }
  
  // Table not found
  const tableMatch = error.match(/no such table: (.*)/i) || 
                     error.match(/relation (['"].*?['"]) does not exist/i) ||
                     error.match(/Table (['"].*?['"]) doesn't exist/i);
                     
  if (tableMatch) {
    return {
      title: 'Missing Table',
      details: error,
      highlight: tableMatch[1]
    };
  }
  
  // Column not found
  const columnMatch = error.match(/no such column: (.*)/i) || 
                      error.match(/column (['"].*?['"]) does not exist/i) ||
                      error.match(/Unknown column (['"].*?['"]) in 'field list'/i);
                      
  if (columnMatch) {
    return {
      title: 'Missing Column',
      details: error,
      highlight: columnMatch[1]
    };
  }

  return { title: 'Query Error', details: error };
}

// Output Log Component
function OutputLog({ activeTab, queryError, isExecuting, formatTime }: any) {
  const parsedError = queryError ? parseError(queryError) : null;

  return (
    <div className="p-4 font-mono text-xs space-y-4 text-foreground/90 max-w-4xl mx-auto mt-2">
      {isExecuting && (
        <div className="flex items-center gap-2 text-muted-foreground p-2">
          <div className="animate-spin h-3 w-3 border-2 border-primary border-t-transparent rounded-full" />
          <span>[{formatTime(new Date())}] Executing query...</span>
        </div>
      )}
      
      {queryError && parsedError && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 font-sans flex items-start gap-3 shadow-sm">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div className="flex-1 space-y-1">
            <h4 className="font-semibold text-destructive text-sm">
              {parsedError.title}
            </h4>
            <div className="text-sm text-foreground/80 leading-relaxed mt-1">
              {parsedError.highlight ? parsedError.details.split(parsedError.highlight).map((part, i, arr) => (
                <React.Fragment key={i}>
                  {part}
                  {i < arr.length - 1 && (
                    <span className="bg-destructive/20 text-destructive font-mono px-1.5 py-0.5 rounded-md font-bold mx-1">
                      {parsedError.highlight}
                    </span>
                  )}
                </React.Fragment>
              )) : (
                <div className="text-xs font-mono bg-background/50 p-2.5 rounded border border-border/50 mt-2 text-muted-foreground whitespace-pre-wrap">
                  {parsedError.details}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab?.executionTimestamp && activeTab.resultRowCount !== undefined && !queryError && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 font-sans">
          <div className="text-green-600 dark:text-green-400 font-medium text-sm flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Query executed successfully
          </div>
          <div className="text-muted-foreground text-xs mt-1.5 ml-6">
            [{formatTime(activeTab.executionTimestamp)}] {activeTab.resultRowCount} row{activeTab.resultRowCount !== 1 ? 's' : ''} {activeTab.resultCommand === 'SELECT' ? 'returned' : 'affected'} in {activeTab.executionTime}ms.
          </div>
        </div>
      )}

      {!isExecuting && !queryError && !activeTab?.resultRows && activeTab?.resultRowCount === undefined && (
        <div className="text-muted-foreground p-2">
          <span>[{formatTime(new Date())}] Ready.</span>
        </div>
      )}
    </div>
  );
}
