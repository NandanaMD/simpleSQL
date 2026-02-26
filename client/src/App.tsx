import { useEffect, useState, useRef } from 'react';
import { useConnectionStore } from './stores/connectionStore';
import { useEditorStore } from './stores/editorStore';
import { useImportStore } from './stores/importStore';
import { useThemeStore } from './stores/themeStore';
import { ConnectionManager } from './components/ConnectionManager';
import { DatabaseExplorer } from './components/DatabaseExplorer';
import { SQLEditor } from './components/SQLEditor';
import { ResultsPanel } from './components/ResultsPanel';
import { ImportWizard } from './components/ImportWizard';
import { SettingsPanel } from './components/SettingsPanel';
import { HelpPanel } from './components/HelpPanel';
import { SavedQueriesDialog } from './components/SavedQueriesDialog';
import { IntroducingSimpleSyntaxDialog } from './components/IntroducingSimpleSyntaxDialog';
import { Toaster } from 'sonner';
import { Plus, FileUp, Sun, Moon, Settings, HelpCircle, BookOpen, Sparkles } from 'lucide-react';
import { Button } from './components/ui/button';

function App() {
  const [showConnectionManager, setShowConnectionManager] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showSavedQueries, setShowSavedQueries] = useState(false);
  const [showIntroSimpleSyntax, setShowIntroSimpleSyntax] = useState(false);
  const [editorHeight, setEditorHeight] = useState(50); // percentage
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { fetchConnections } = useConnectionStore();
  const { tabs, createTab, activeTabId, setTabMode } = useEditorStore();
  const { openWizard } = useImportStore();
  const { theme, toggleTheme, setTheme } = useThemeStore();

  const handleTrySimpleSyntax = () => {
    if (activeTabId) {
      setTabMode(activeTabId, 'simple');
    }
  };

  useEffect(() => {
    fetchConnections();
    // Apply theme on mount
    setTheme(theme);
  }, [fetchConnections, setTheme, theme]);

  useEffect(() => {
    if (tabs.length === 0) {
      createTab();
    }
  }, [tabs, createTab]);

  // Resizing logic
  const handleMouseDown = () => {
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !containerRef.current) return;
      
      const container = containerRef.current;
      const containerRect = container.getBoundingClientRect();
      const offsetY = e.clientY - containerRect.top;
      const percentage = (offsetY / containerRect.height) * 100;
      
      // Clamp between 20% and 80%
      const clampedPercentage = Math.max(20, Math.min(80, percentage));
      setEditorHeight(clampedPercentage);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="h-14 border-b border-border flex items-center justify-between px-4 bg-card">
        <h1 className="text-xl font-semibold">SimpleSQL</h1>
        <div className="flex items-center gap-2">
          <Button 
            size="sm" 
            variant="default"
            className="bg-[#0078d4] hover:bg-[#106ebe] text-white"
            onClick={() => setShowIntroSimpleSyntax(true)} 
            title="Introducing SimpleSyntax"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Introducing SimpleSyntax
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setShowSavedQueries(true)} title="Saved Queries">
            <BookOpen className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setShowHelp(true)} title="Help">
            <HelpCircle className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={toggleTheme} title="Toggle Theme">
            {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setShowSettings(true)} title="Settings">
            <Settings className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => openWizard()}>
            <FileUp className="h-4 w-4 mr-2" />
            Import
          </Button>
          <Button size="sm" onClick={() => setShowConnectionManager(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Connection
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Database Explorer */}
        <aside className="w-64 border-r border-border bg-card overflow-y-auto">
          <DatabaseExplorer />
        </aside>

        {/* Main Editor Area - Resizable */}
        <main ref={containerRef} className="flex-1 flex flex-col overflow-hidden relative">
          {/* SQL Editor */}
          <div style={{ height: `${editorHeight}%` }} className="overflow-hidden">
            <SQLEditor />
          </div>

          {/* Resize Handle */}
          <div 
            className={`h-1 bg-border hover:bg-primary cursor-row-resize transition-colors ${isResizing ? 'bg-primary' : ''}`}
            onMouseDown={handleMouseDown}
            title="Drag to resize"
          />

          {/* Results Panel */}
          <div style={{ height: `${100 - editorHeight}%` }} className="overflow-hidden">
            <ResultsPanel />
          </div>
        </main>
      </div>

      {/* Connection Manager Dialog */}
      <ConnectionManager open={showConnectionManager} onOpenChange={setShowConnectionManager} />

      {/* Import Wizard */}
      <ImportWizard />

      {/* Settings Panel */}
      <SettingsPanel open={showSettings} onOpenChange={setShowSettings} />

      {/* Help Panel */}
      <HelpPanel open={showHelp} onOpenChange={setShowHelp} />

      {/* Saved Queries */}
      <SavedQueriesDialog open={showSavedQueries} onOpenChange={setShowSavedQueries} />

      {/* Introducing SimpleSyntax */}
      <IntroducingSimpleSyntaxDialog 
        open={showIntroSimpleSyntax} 
        onOpenChange={setShowIntroSimpleSyntax}
        onTryNow={handleTrySimpleSyntax}
      />

      {/* Toast Notifications */}
      <Toaster position="bottom-right" />
    </div>
  );
}

export default App;
