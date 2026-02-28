import { useRef, useCallback, useEffect, useState } from 'react';
import { useEditorStore } from '../stores/editorStore';
import { useConnectionStore } from '../stores/connectionStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useThemeStore } from '../stores/themeStore';
import Editor, { OnMount } from '@monaco-editor/react';
import { X, Plus, Code2, AlertTriangle, HelpCircle } from 'lucide-react';
import { Button } from './ui/button';
import * as api from '../lib/api';
import { toast } from 'sonner';
import type { QueryRequest } from '@sql-ide/shared';
import executeIcon from '../../../assets/icons/execute.svg';

import { formatSQL, validateSQL } from '../lib/sqlFormatter';
import { interpretError, clearHighlights } from '../lib/errorInterpreter';
import { translate } from '../lib/simpleSyntaxParser';
import { SimpleSyntaxHelpDialog } from './SimpleSyntaxHelpDialog';

export function SQLEditor() {
  const {
    tabs,
    activeTabId,
    createTab,
    closeTab,
    setActiveTab,
    updateTabContent,
    setTabResult,
    setTabError,
    setTabDecorations,
    setTabMode,
    setTabConnection,
    setTabTranslatedSql,
    clearTabResult,
    setQueryError,
    setIsExecuting,
    isExecuting,
    addToHistory,
  } = useEditorStore();
  const { connections, selectedConnectionId, selectedDatabase } = useConnectionStore();
  const { editor: editorSettings, query: querySettings } = useSettingsStore();
  const { theme } = useThemeStore();
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const handleExecuteRef = useRef<(() => void) | null>(null);
  const handleFormatRef = useRef<(() => void) | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  const activeTab = tabs.find((tab) => tab.id === activeTabId);
  const currentMode = activeTab?.mode || 'sql';

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Add keyboard shortcut for execution (Ctrl+Enter)
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      handleExecuteRef.current?.();
    });

    // Add keyboard shortcut for formatting (Ctrl+Shift+F)
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF, () => {
      handleFormatRef.current?.();
    });

    // Add keyboard shortcut for mode toggle (Ctrl+Shift+M)
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyM, () => {
      if (activeTab) {
        const newMode = currentMode === 'sql' ? 'simple' : 'sql';
        setTabMode(activeTab.id, newMode);
        if (newMode === 'sql') {
          setTabTranslatedSql(activeTab.id, undefined);
        }
      }
    });

    // Register autocomplete provider
    monaco.languages.registerCompletionItemProvider('sql', {
      provideCompletionItems: async (model: any, position: any) => {
        // Only provide suggestions if we have a connection and database selected
        if (!selectedConnectionId || !selectedDatabase) {
          return { suggestions: [] };
        }

        try {
          const suggestions = await api.getAutocompleteSuggestions(
            selectedConnectionId,
            selectedDatabase
          );

          const word = model.getWordUntilPosition(position);
          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn,
          };

          const completionItems = suggestions.map((suggestion) => {
            let kind: any;
            switch (suggestion.kind) {
              case 'keyword':
                kind = monaco.languages.CompletionItemKind.Keyword;
                break;
              case 'table':
                kind = monaco.languages.CompletionItemKind.Class;
                break;
              case 'column':
                kind = monaco.languages.CompletionItemKind.Field;
                break;
              case 'function':
                kind = monaco.languages.CompletionItemKind.Function;
                break;
              case 'database':
                kind = monaco.languages.CompletionItemKind.Module;
                break;
              default:
                kind = monaco.languages.CompletionItemKind.Text;
            }

            return {
              label: suggestion.label,
              kind,
              detail: suggestion.detail,
              documentation: suggestion.documentation,
              insertText: suggestion.insertText || suggestion.label,
              range,
            };
          });

          return { suggestions: completionItems };
        } catch (error) {
          console.error('Autocomplete failed:', error);
          return { suggestions: [] };
        }
      },
    });
  };

  const handleModeToggle = useCallback((mode: 'sql' | 'simple') => {
    if (!activeTab) return;
    
    setTabMode(activeTab.id, mode);
    
    // Clear translated SQL when switching modes
    if (mode === 'sql') {
      setTabTranslatedSql(activeTab.id, undefined);
    }
    
    // Show warning if switching to SimpleSyntax with content
    if (mode === 'simple' && activeTab.content.trim()) {
      toast.info("You're in SimpleSyntax mode. Editor contains SQL code. Switch back to SQL mode or clear editor.", {
        duration: 6000,
      });
    }
  }, [activeTab, setTabMode, setTabTranslatedSql]);

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

    const hasTabConnection = Boolean(activeTab.connectionId);
    const tabConnectionExists = hasTabConnection
      ? connections.some((connection) => connection.id === activeTab.connectionId)
      : false;

    const connectionId = tabConnectionExists
      ? activeTab.connectionId
      : selectedConnectionId;

    if (!connectionId) {
      toast.error('Please select a connection first');
      return;
    }

    if (!selectedDatabase) {
      toast.error('Please select a database first (double-click on a database in the explorer)');
      return;
    }

    if (activeTab.connectionId !== connectionId) {
      setTabConnection(activeTab.id, connectionId, selectedDatabase);
    }

    // Clear previous tab result state before starting a new execution attempt
    clearTabResult(activeTab.id);
    setQueryError(null);

    // Get the current mode
    const mode = currentMode;
    let sqlToExecute = trimmedContent;
    
    // If in SimpleSyntax mode, translate first
    if (mode === 'simple') {
      const translationResult = translate(trimmedContent);
      
      if (!translationResult.success) {
        // Show SimpleSyntax parse error
        const error = translationResult.error!;
        setTabError(activeTab.id, `SimpleSyntax Error: ${error.message}`);
        setQueryError(`SimpleSyntax Error: ${error.message}`);
        
        // Highlight the error token in the editor
        if (editorRef.current && monacoRef.current && error.position >= 0) {
          const model = editorRef.current.getModel();
          if (model) {
            const pos = model.getPositionAt(error.position);
            const wordAtPos = model.getWordAtPosition(pos);
            
            const decorations = [{
              range: new monacoRef.current.Range(
                pos.lineNumber,
                wordAtPos?.startColumn || pos.column,
                pos.lineNumber,
                wordAtPos?.endColumn || pos.column + error.token.length
              ),
              options: {
                className: 'error-highlight',
                inlineClassName: 'error-highlight-inline',
                minimap: { color: '#ff0000', position: 2 }
              }
            }];
            
            const decorationIds = editorRef.current.deltaDecorations([], decorations);
            setTabDecorations(activeTab.id, decorationIds);
          }
        }
        
        toast.error(`SimpleSyntax Error: ${error.message}`, {
          duration: 8000,
        });
        
        // Clear translated SQL on error
        setTabTranslatedSql(activeTab.id, undefined);
        
        return; // DO NOT execute SQL
      }
      
      // Translation succeeded
      sqlToExecute = translationResult.sql!;
      
      // Show SQL preview
      setTabTranslatedSql(activeTab.id, sqlToExecute);
    }
    
    // Validate SQL (only for SQL mode)
    if (mode === 'sql') {
      const validation = validateSQL(sqlToExecute);
      if (!validation.valid) {
        const errorMessage = validation.errors.join(', ');
        toast.error(errorMessage, { duration: 5000 });
        setQueryError(errorMessage);
        setTabError(activeTab.id, errorMessage);
        return;
      }

      if (validation.warnings.length > 0) {
        toast.warning(validation.warnings.join(', '), { duration: 5000 });
      }
    }

    // Check for destructive operations (only in SQL mode)
    if (mode === 'sql') {
      const isDeleteStatement = /^\s*DELETE\b/i.test(sqlToExecute);
      const isDropStatement = /^\s*DROP\b/i.test(sqlToExecute);
      const hasWhereClause = /\bWHERE\b/i.test(sqlToExecute);

      if (isDeleteStatement && querySettings.confirmDelete && !hasWhereClause) {
        if (!confirm('⚠️ This DELETE has no WHERE clause and will affect all rows. Continue?')) {
          return;
        }
      }

      if (isDropStatement && querySettings.confirmDrop) {
        if (!confirm('⚠️ DROP operations are irreversible. Continue?')) {
          return;
        }
      }
    }
    
    // Update the tab content with the current editor value to ensure sync
    if (currentContent !== activeTab.content) {
      updateTabContent(activeTab.id, currentContent);
    }

    // Set execution state
    setIsExecuting(true);
    const startTime = Date.now();

    try {
      const request: QueryRequest = {
        connectionId,
        sql: sqlToExecute,
        database: selectedDatabase,
        timeout: querySettings.timeout,
      };

      const result = await api.executeQuery(request);
      
      // Store result in the active tab
      setTabResult(activeTab.id, result, {
        sql: sqlToExecute,
        mode,
        connectionId,
        database: selectedDatabase,
      });

      const executionTime = Date.now() - startTime;

      // Clear any error highlights on successful execution
      if (editorRef.current) {
        clearHighlights(editorRef.current);
        setTabDecorations(activeTab.id, []);
      }

      // Add to history with mode information
      addToHistory({
        id: `${Date.now()}`,
        sql: sqlToExecute,
        connectionId,
        database: selectedDatabase,
        executedAt: new Date().toISOString(),
        executionTime,
        rowCount: result.rowCount,
        success: true,
        mode,
        input: mode === 'simple' ? trimmedContent : undefined,
        translatedSql: mode === 'simple' ? sqlToExecute : undefined,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Query execution failed';
      
      // Use rule-based error interpreter
      const interpreted = interpretError(
        errorMessage,
        sqlToExecute,
        editorRef.current
      );
      
      // Store error in the tab
      setTabError(activeTab.id, errorMessage);
      setQueryError(errorMessage);
      
      // Show user-friendly interpretation
      toast.error(interpreted.naturalMessage, {
        duration: 8000,
        description: interpreted.suggestion + (mode === 'simple' ? `\n\nGenerated SQL: ${sqlToExecute}` : ''),
      });

      addToHistory({
        id: `${Date.now()}`,
        sql: sqlToExecute,
        connectionId,
        database: selectedDatabase,
        executedAt: new Date().toISOString(),
        executionTime: Date.now() - startTime,
        rowCount: 0,
        success: false,
        mode,
        input: mode === 'simple' ? trimmedContent : undefined,
        translatedSql: mode === 'simple' ? sqlToExecute : undefined,
      });
    } finally {
      setIsExecuting(false);
    }
  }, [activeTab, selectedConnectionId, selectedDatabase, connections, querySettings, currentMode, updateTabContent, setTabConnection, setTabResult, setTabError, setTabDecorations, setTabTranslatedSql, clearTabResult, setQueryError, setIsExecuting, addToHistory]);

  // Keep the refs updated with the latest handlers
  useEffect(() => {
    handleExecuteRef.current = handleExecute;
  }, [handleExecute]);

  useEffect(() => {
    handleFormatRef.current = handleFormat;
  }, [handleFormat]);

  // Restore decorations when switching tabs
  useEffect(() => {
    if (!editorRef.current || !activeTab) return;

    // Clear all decorations first
    clearHighlights(editorRef.current);

    // Restore tab-specific decorations if they exist
    if (activeTab.decorations && activeTab.decorations.length > 0) {
      // Decorations need to be re-applied as Monaco doesn't preserve them across content changes
      // We need to reinterpret the error to get the decoration objects
      if (activeTab.errorInfo) {
        interpretError(
          activeTab.errorInfo,
          activeTab.content,
          editorRef.current
        );
      }
    }
  }, [activeTabId, activeTab]);

  return (
    <div className="h-full flex flex-col">
      {/* Tabs Bar */}
      <div className="h-10 border-b border-border flex items-center bg-card">
        <div className="flex items-center flex-1 overflow-x-auto">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={`flex items-center gap-2 px-3 py-2 border-r border-border cursor-pointer transition-colors ${
                tab.id === activeTabId 
                  ? 'bg-background border-b-2 border-b-primary font-semibold' 
                  : 'hover:bg-accent'
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
      <div className="h-9 border-b border-border flex items-center gap-1.5 px-2 bg-card">
        {/* Mode Toggle */}
        <div className="flex items-center border border-border rounded-md overflow-hidden">
          <button
            className={`px-2.5 py-0.5 text-xs transition-colors ${
              currentMode === 'sql'
                ? 'bg-accent text-accent-foreground font-medium'
                : 'bg-transparent text-muted-foreground hover:bg-accent font-normal'
            }`}
            onClick={() => handleModeToggle('sql')}
            title="SQL Mode"
          >
            SQL
          </button>
          <button
            className={`px-2.5 py-0.5 text-xs transition-colors ${
              currentMode === 'simple'
                ? 'bg-accent text-accent-foreground font-medium'
                : 'bg-transparent text-muted-foreground hover:bg-accent font-normal'
            }`}
            onClick={() => handleModeToggle('simple')}
            title="SimpleSyntax Mode (Ctrl+Shift+M)"
          >
            SimpleSyntax
          </button>
        </div>

        <Button size="sm" className="h-7 px-2.5 text-xs" onClick={handleExecute} disabled={isExecuting}>
          <img src={executeIcon} alt="" aria-hidden="true" className="h-3.5 w-3.5 mr-1.5" />
          Execute
        </Button>
        <Button size="sm" className="h-7 px-2.5 text-xs" variant="outline" onClick={handleFormat} disabled={isExecuting || currentMode === 'simple'} title="Format SQL (Ctrl+Shift+F)">
          <Code2 className="h-3.5 w-3.5 mr-1.5" />
          Format
        </Button>

        {/* Mode Label */}
        <span className="text-xs font-mono text-muted-foreground ml-2">
          Mode: {currentMode === 'sql' ? 'SQL' : 'SimpleSyntax'}
        </span>

        {/* Help Icon for SimpleSyntax */}
        {currentMode === 'simple' && (
          <Button 
            size="sm" 
            variant="ghost" 
            className="h-7 w-7 p-0" 
            title="SimpleSyntax Help"
            onClick={() => setShowHelp(true)}
          >
            <HelpCircle className="h-4 w-4" />
          </Button>
        )}

        {selectedConnectionId && selectedDatabase && (
          <span className="text-xs text-muted-foreground ml-auto">
            {connections.find((c) => c.id === selectedConnectionId)?.name} / {selectedDatabase}
          </span>
        )}
        {selectedConnectionId && !selectedDatabase && (
          <span className="text-xs text-yellow-600 flex items-center gap-1 ml-auto">
            <AlertTriangle className="h-3 w-3" />
            Select a database to run queries
          </span>
        )}
      </div>

      {/* Editor */}
      <div className="flex-1 flex flex-col">
        <div className="flex-1">
          {activeTab ? (
            <Editor
              height="100%"
              defaultLanguage="sql"
              value={activeTab.content}
              onChange={(value) => {
                updateTabContent(activeTab.id, value || '');
                // Clear translated SQL on content change in SimpleSyntax mode
                if (currentMode === 'simple' && activeTab.translatedSql) {
                  setTabTranslatedSql(activeTab.id, undefined);
                }
              }}
              onMount={handleEditorDidMount}
              theme={theme === 'dark' ? 'vs-dark' : 'vs'}
              options={{
                minimap: { enabled: editorSettings.minimap },
                fontSize: editorSettings.fontSize,
                tabSize: editorSettings.tabSize,
                fontFamily: editorSettings.fontFamily,
                fontWeight: '600',
                fontLigatures: true,
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

        {/* SQL Preview Status Bar - Only in SimpleSyntax mode with translated SQL */}
        {currentMode === 'simple' && activeTab?.translatedSql && (
          <div className="h-8 border-t border-border bg-muted/60 px-3 flex items-center justify-between text-xs font-mono">
            <div className="flex items-center gap-2 flex-1 overflow-hidden">
              <span className="text-muted-foreground">Translated SQL:</span>
              <span className="text-foreground truncate" title={activeTab.translatedSql}>
                {activeTab.translatedSql}
              </span>
            </div>
            <button
              className="ml-2 px-2 py-1 text-muted-foreground hover:text-foreground hover:bg-accent rounded"
              onClick={() => {
                navigator.clipboard.writeText(activeTab.translatedSql || '');
                toast.success('SQL copied to clipboard');
              }}
              title="Copy SQL"
            >
              Copy
            </button>
          </div>
        )}
      </div>

      {/* SimpleSyntax Help Dialog */}
      <SimpleSyntaxHelpDialog open={showHelp} onOpenChange={setShowHelp} />
    </div>
  );
}
