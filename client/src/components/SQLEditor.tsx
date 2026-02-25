import { useRef, useCallback, useEffect } from 'react';
import { useEditorStore } from '../stores/editorStore';
import { useConnectionStore } from '../stores/connectionStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useThemeStore } from '../stores/themeStore';
import Editor, { OnMount } from '@monaco-editor/react';
import { Play, X, Plus, Code2, AlertTriangle } from 'lucide-react';
import { Button } from './ui/button';
import * as api from '../lib/api';
import { toast } from 'sonner';
import type { QueryRequest } from '@sql-ide/shared';
import { translateError, parseErrorPosition } from '../lib/errorTranslator';
import { formatSQL, validateSQL } from '../lib/sqlFormatter';
import { interpretError, clearHighlights } from '../lib/errorInterpreter';

export function SQLEditor() {
  const {
    tabs,
    activeTabId,
    createTab,
    closeTab,
    setActiveTab,
    updateTabContent,
    addResultTab,
    setQueryError,
    setIsExecuting,
    isExecuting,
    addToHistory,
    clearAllResultTabs,
  } = useEditorStore();
  const { connections, selectedConnectionId, selectedDatabase } = useConnectionStore();
  const { editor: editorSettings, query: querySettings } = useSettingsStore();
  const { theme } = useThemeStore();
  const editorRef = useRef<any>(null);
  const handleExecuteRef = useRef<(() => void) | null>(null);
  const handleFormatRef = useRef<(() => void) | null>(null);

  const activeTab = tabs.find((tab) => tab.id === activeTabId);

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    // Add keyboard shortcut for execution (Ctrl+Enter)
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      handleExecuteRef.current?.();
    });

    // Add keyboard shortcut for formatting (Ctrl+Shift+F)
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF, () => {
      handleFormatRef.current?.();
    });
  };

  const handleFormat = useCallback(() => {
    if (!editorRef.current || !activeTab) return;
    
    const currentContent = editorRef.current.getValue();
    if (!currentContent.trim()) return;

    try {
      const formatted = formatSQL(currentContent);
      editorRef.current.setValue(formatted);
      updateTabContent(activeTab.id, formatted);
      toast.success('SQL formatted successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Formatting failed';
      toast.error(errorMessage);
    }
  }, [activeTab, updateTabContent]);

  const handleExecute = useCallback(async () => {
    if (!editorRef.current || !activeTab) return;

    const currentContent = editorRef.current.getValue();
    const trimmedContent = currentContent.trim();
    
    if (!trimmedContent) {
      toast.error('Query is empty');
      return;
    }

    // Validate query first
    const validation = validateSQL(trimmedContent);
    if (!validation.valid) {
      const errorMessage = validation.errors.join(', ');
      toast.error(errorMessage, { duration: 5000 });
      setQueryError(errorMessage);
      return;
    }

    // Check for destructive operations  
    const upperSQL = trimmedContent.toUpperCase();
    if ((upperSQL.includes('DELETE') || upperSQL.includes('DROP')) && querySettings.confirmDelete) {
      if (!upperSQL.includes('WHERE') && !confirm('⚠️ This operation has no WHERE clause and will affect all rows. Continue?')) {
        return;
      }
    }
    
    // Update the tab content with the current editor value to ensure sync
    if (currentContent !== activeTab.content) {
      updateTabContent(activeTab.id, currentContent);
    }

    const connectionId = activeTab.connectionId || selectedConnectionId;
    if (!connectionId) {
      toast.error('Please select a connection first');
      return;
    }

    if (!selectedDatabase) {
      toast.error('Please select a database first (double-click on a database in the explorer)');
      return;
    }

    const connection = connections.find((c) => c.id === connectionId);
    if (!connection) {
      toast.error('Connection not found');
      return;
    }

    // Clear previous results on new query
    clearAllResultTabs();
    setIsExecuting(true);
    setQueryError(null);
    const startTime = Date.now();

    try {
      const request: QueryRequest = {
        connectionId,
        sql: trimmedContent,
        database: selectedDatabase,
        timeout: querySettings.timeout,
      };

      const result = await api.executeQuery(request);
      addResultTab(result);

      const executionTime = Date.now() - startTime;

      // Clear any error highlights on successful execution
      if (editorRef.current) {
        clearHighlights(editorRef.current);
      }

      // Add to history
      addToHistory({
        id: `${Date.now()}`,
        sql: trimmedContent,
        connectionId,
        database: selectedDatabase,
        executedAt: new Date().toISOString(),
        executionTime,
        rowCount: result.rowCount,
        success: true,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Query execution failed';
      
      // Use rule-based error interpreter
      const interpreted = interpretError(
        errorMessage,
        trimmedContent,
        editorRef.current
      );
      
      // Set error for display in results panel
      setQueryError(errorMessage);
      
      // Show user-friendly interpretation
      toast.error(interpreted.naturalMessage, {
        duration: 8000,
        description: interpreted.suggestion,
      });

      addToHistory({
        id: `${Date.now()}`,
        sql: trimmedContent,
        connectionId,
        database: selectedDatabase,
        executedAt: new Date().toISOString(),
        executionTime: Date.now() - startTime,
        rowCount: 0,
        success: false,
      });
    } finally {
      setIsExecuting(false);
    }
  }, [activeTab, selectedConnectionId, selectedDatabase, connections, querySettings, updateTabContent, addResultTab, setQueryError, setIsExecuting, addToHistory, clearAllResultTabs]);

  // Keep the refs updated with the latest handlers
  useEffect(() => {
    handleExecuteRef.current = handleExecute;
  }, [handleExecute]);

  useEffect(() => {
    handleFormatRef.current = handleFormat;
  }, [handleFormat]);

  return (
    <div className="h-full flex flex-col">
      {/* Tabs Bar */}
      <div className="h-10 border-b border-border flex items-center bg-card">
        <div className="flex items-center flex-1 overflow-x-auto">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={`flex items-center gap-2 px-3 py-2 border-r border-border cursor-pointer transition-colors ${
                tab.id === activeTabId ? 'bg-background' : 'hover:bg-accent'
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="text-sm truncate max-w-32">{tab.title}</span>
              {tab.isDirty && <span className="text-xs">•</span>}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
                className="hover:bg-destructive/20 rounded-sm p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => createTab()}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Toolbar */}
      <div className="h-10 border-b border-border flex items-center gap-2 px-2 bg-card">
        <Button size="sm" onClick={handleExecute} disabled={isExecuting}>
          <Play className="h-4 w-4 mr-2" />
          Execute
        </Button>
        <Button size="sm" variant="outline" onClick={handleFormat} disabled={isExecuting} title="Format SQL (Ctrl+Shift+F)">
          <Code2 className="h-4 w-4 mr-2" />
          Format
        </Button>

        {selectedConnectionId && selectedDatabase && (
          <span className="text-xs text-muted-foreground ml-2">
            {connections.find((c) => c.id === selectedConnectionId)?.name} / {selectedDatabase}
          </span>
        )}
        {selectedConnectionId && !selectedDatabase && (
          <span className="text-xs text-yellow-600 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Select a database to run queries
          </span>
        )}
      </div>

      {/* Editor */}
      <div className="flex-1">
        {activeTab ? (
          <Editor
            height="100%"
            defaultLanguage="sql"
            value={activeTab.content}
            onChange={(value) => updateTabContent(activeTab.id, value || '')}
            onMount={handleEditorDidMount}
            theme={theme === 'dark' ? 'vs-dark' : 'vs'}
            options={{
              minimap: { enabled: editorSettings.minimap },
              fontSize: editorSettings.fontSize,
              tabSize: editorSettings.tabSize,
              fontFamily: editorSettings.fontFamily,
              lineNumbers: editorSettings.lineNumbers ? 'on' : 'off',
              wordWrap: editorSettings.wordWrap ? 'on' : 'off',
              renderWhitespace: 'selection',
              automaticLayout: true,
              scrollBeyondLastLine: false,
              suggestOnTriggerCharacters: true,
              quickSuggestions: true,
            }}
          />
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            No active editor tab
          </div>
        )}
      </div>
    </div>
  );
}
