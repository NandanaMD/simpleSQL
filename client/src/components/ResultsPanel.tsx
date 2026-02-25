import React, { useMemo, useState } from 'react';
import { useEditorStore } from '../stores/editorStore';
import { useSettingsStore } from '../stores/settingsStore';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
  SortingState,
} from '@tanstack/react-table';
import { Download, X, Search } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

export function ResultsPanel() {
  const { resultTabs, activeResultTabId, setActiveResultTab, closeResultTab, queryError, isExecuting } = useEditorStore();
  const { format: formatSettings } = useSettingsStore();
  const [globalFilter, setGlobalFilter] = useState('');

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const activeResultTab = resultTabs.find(tab => tab.id === activeResultTabId);

  const exportToCSV = () => {
    if (!activeResultTab) return;
    const result = activeResultTab.result;
    
    try {
      const headers = result.fields.map((f: any) => f.name).join(',');
      const rows = result.rows.map((row: any) => 
        result.fields.map((field: any) => {
          const value = row[field.name];
          if (value === null) return '';
          if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }).join(',')
      );
      const csv = [headers, ...rows].join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `query_results_${new Date().getTime()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      // Silent fail
    }
  };

  const currentTab = activeResultTabId || 'output';

  return (
    <div className="flex flex-col items-start bg-background border-t border-border overflow-auto">
      <Tabs value={currentTab} onValueChange={(value) => {
        if (value === 'output') {
          setActiveResultTab('');
        } else {
          setActiveResultTab(value);
        }
      }} className="w-full flex flex-col">
        <TabsList className="w-full justify-start rounded-none border-b border-border bg-card h-9 p-0">
          {resultTabs.map((tab) => (
            <TabsTrigger 
              key={tab.id} 
              value={tab.id} 
              className="text-xs h-9 px-3 data-[state=active]:bg-background data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none relative group"
            >
              <span>{tab.label}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeResultTab(tab.id);
                }}
                className="ml-2 hover:bg-destructive/20 rounded-sm p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </TabsTrigger>
          ))}
          <TabsTrigger 
            value="output" 
            className="text-xs h-9 px-3 data-[state=active]:bg-background data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
          >
            Output
          </TabsTrigger>
          {resultTabs.length > 0 && (
            <div className="ml-auto flex items-center gap-2 mr-2">
              <div className="relative">
                <Search className="absolute left-2 top-2 h-3 w-3 text-muted-foreground" />
                <Input
                  placeholder="Filter results..."
                  value={globalFilter}
                  onChange={(e) => setGlobalFilter(e.target.value)}
                  className="h-7 text-xs pl-7 w-48"
                />
              </div>
              <Button size="sm" variant="ghost" onClick={exportToCSV} className="h-7 text-xs">
                <Download className="h-3 w-3 mr-1" />
                Export
              </Button>
            </div>
          )}
        </TabsList>

        {/* Result Tabs Content */}
        {resultTabs.map((tab) => (
          <TabsContent key={tab.id} value={tab.id} className="m-0">
            <div className="w-[900px] max-w-[95%] h-[300px] ml-5 my-5 border border-border overflow-hidden rounded-lg">
              <ResultGrid result={tab.result} globalFilter={globalFilter} formatSettings={formatSettings} />
            </div>
          </TabsContent>
        ))}

        {/* Output Tab */}
        <TabsContent value="output" className="flex-1 m-0 overflow-auto bg-background">
          <OutputLog 
            resultTabs={resultTabs} 
            queryError={queryError} 
            isExecuting={isExecuting} 
            formatTime={formatTime}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Result Grid Component
function ResultGrid({ result, globalFilter, formatSettings }: { result: any; globalFilter: string; formatSettings: any }) {
  const [sorting, setSorting] = React.useState<SortingState>([]);

  const columns = useMemo(() => {
    if (!result || result.rows.length === 0) return [];

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

    const dataColumns = result.fields.map((field: any) =>
      columnHelper.accessor(field.name, {
        header: field.name,
        cell: (info) => {
          const value = info.getValue();
          if (value === null || value === undefined) {
            return <span className="text-orange-500 italic text-xs font-semibold bg-orange-50 dark:bg-orange-950/30 px-1 rounded">{formatSettings.nullDisplay}</span>;
          }
          if (typeof value === 'boolean') {
            return <span className={`text-xs font-semibold ${value ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{value ? formatSettings.booleanDisplay.true : formatSettings.booleanDisplay.false}</span>;
          }
          if (typeof value === 'number') {
            const formatted = Number.isInteger(value) ? value : value.toFixed(formatSettings.numberPrecision);
            return <span className="text-xs font-mono text-blue-600 dark:text-blue-400">{formatted}</span>;
          }
          if (typeof value === 'string') {
            // Date/Time detection
            if (value.match(/^\d{4}-\d{2}-\d{2}/)) {
              return <span className="text-xs font-mono text-purple-600 dark:text-purple-400">{value}</span>;
            }
            // URL detection
            if (value.match(/^https?:\/\//)) {
              return <a href={value} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 dark:text-blue-400 hover:underline">{value}</a>;
            }
            // Long strings
            if (value.length > 100) {
              return <span className="text-xs" title={value}>{value.substring(0, 100)}...</span>;
            }
          }
          if (typeof value === 'object') {
            return <span className="text-xs font-mono">{JSON.stringify(value)}</span>;
          }
          return <span className="text-xs">{String(value)}</span>;
        },
        size: 150,
      })
    );

    return [rowNumberColumn, ...dataColumns];
  }, [result, formatSettings]);

  const table = useReactTable({
    data: result?.rows || [],
    columns,
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

  if (!result || result.rows.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground text-xs bg-card">
        No rows returned
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto bg-card">
      <table className="w-full border-collapse">
        <thead className="sticky top-0 bg-muted z-10">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className={`px-4 py-2 text-left text-xs font-medium border-b border-border cursor-pointer hover:bg-muted/40 transition-colors ${
                    header.id === '_rowNumber' ? 'w-12 bg-muted/30' : ''
                  }`}
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
        <tbody>
          {table.getRowModel().rows.map((row, rowIndex) => (
            <tr
              key={row.id}
              className={`border-b border-border hover:bg-accent/20 transition-colors ${
                rowIndex % 2 === 0 ? '' : 'bg-muted/5'
              }`}
            >
              {row.getVisibleCells().map((cell) => (
                <td
                  key={cell.id}
                  className={`px-4 py-2 ${
                    cell.column.id === '_rowNumber' ? 'bg-muted/10 text-center' : ''
                  }`}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Output Log Component
function OutputLog({ resultTabs, queryError, isExecuting, formatTime }: any) {
  return (
    <div className="p-3 font-mono text-xs space-y-0.5 text-foreground/90">
      {isExecuting && (
        <div>
          <span className="text-muted-foreground/60">[{formatTime(new Date())}]</span> Executing query...
        </div>
      )}
      
      {queryError && (
        <>
          <div className="text-destructive">
            <span className="text-muted-foreground/60">[{formatTime(new Date())}]</span> Error: {queryError}
          </div>
        </>
      )}

      {resultTabs.slice().reverse().map((tab: any) => (
        <div key={tab.id} className="mb-1">
          <div>
            <span className="text-muted-foreground/60">[{formatTime(tab.timestamp)}]</span> ✔ Query executed successfully.
          </div>
          <div>
            <span className="text-muted-foreground/60">[{formatTime(tab.timestamp)}]</span> {tab.result.rowCount} row{tab.result.rowCount !== 1 ? 's' : ''} {tab.result.command === 'SELECT' ? 'returned' : 'affected'} in {tab.result.executionTime}ms.
          </div>
        </div>
      ))}

      {!isExecuting && !queryError && resultTabs.length === 0 && (
        <div className="text-muted-foreground">
          <span className="text-muted-foreground/60">[{formatTime(new Date())}]</span> Ready.
        </div>
      )}
    </div>
  );
}
