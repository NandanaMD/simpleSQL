import { useEffect, useState, useRef } from 'react';
import { useConnectionStore } from './stores/connectionStore';
import { useEditorStore } from './stores/editorStore';
import { useImportStore } from './stores/importStore';
import { useThemeStore } from './stores/themeStore';
import { ConnectionHub } from './components/ConnectionHub';
import { DatabaseExplorer } from './components/DatabaseExplorer';
import { SQLEditor } from './components/SQLEditor';
import { ResultsPanel } from './components/ResultsPanel';
import { ImportWizard } from './components/ImportWizard';
import { SettingsPanel } from './components/SettingsPanel';
import { HelpPanel } from './components/HelpPanel';
import { SavedQueriesDialog } from './components/SavedQueriesDialog';
import { IntroducingSimpleSyntaxDialog } from './components/IntroducingSimpleSyntaxDialog';
import { LearnModePanel } from './components/LearnModePanel';
import { Toaster, toast } from 'sonner';
import { Sun, Moon, Sparkles, GraduationCap } from 'lucide-react';
import { Button } from './components/ui/button';
import savedQueriesIcon from '../../assets/icons/saved_queries.svg';
import helpIcon from '../../assets/icons/help.svg';
import settingsIcon from '../../assets/icons/settings.svg';
import importIcon from '../../assets/icons/import.svg';
import connectionIcon from '../../assets/icons/connection.svg';
import { useLearnStore } from './stores/learnStore';

function App() {
  const [showConnectionHub, setShowConnectionHub] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showSavedQueries, setShowSavedQueries] = useState(false);
  const [showIntroSimpleSyntax, setShowIntroSimpleSyntax] = useState(false);
  const [editorHeight, setEditorHeight] = useState(50); // percentage
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { fetchConnections, setActiveConnection } = useConnectionStore();
  const { tabs, createTab, loadTabsForConnection, activeTabId, setTabMode } = useEditorStore();
  const { openWizard } = useImportStore();
  const { theme, toggleTheme, setTheme } = useThemeStore();
  const { enabled: learnModeEnabled, toggle: toggleLearnMode } = useLearnStore();

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
    if (!window.electron?.onUpdateStatus) {
      return;
    }

    const dismissId = 'app-update-progress';

    const unsubscribe = window.electron.onUpdateStatus((event) => {
      if (event.status === 'available') {
        toast.message(`Update available${event.version ? `: v${event.version}` : ''}`, {
          description: 'Downloading in background...',
          duration: 3500,
        });
      }

      if (event.status === 'downloading' && typeof event.percent === 'number') {
        toast.message(`Downloading update ${event.percent}%`, {
          id: dismissId,
          duration: Number.POSITIVE_INFINITY,
        });
      }

      if (event.status === 'downloaded') {
        toast.success('Update downloaded. Installing now...', {
          id: dismissId,
          duration: 2500,
        });
      }

      if (event.status === 'error' && event.message) {
        toast.error('Update check failed', {
          description: event.message,
          duration: 4000,
        });
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!showConnectionHub && tabs.length === 0) {
      createTab();
    }
  }, [tabs, createTab, showConnectionHub]);

  const handleEnterWorkspace = (connectionId: string, database: string) => {
    loadTabsForConnection(connectionId, database);
    setActiveConnection(connectionId, database);
    setShowConnectionHub(false);
  };

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

  if (showConnectionHub) {
    return (
      <>
        <ConnectionHub onEnterWorkspace={handleEnterWorkspace} />
        <Toaster position="top-right" />
      </>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="h-14 border-b border-border flex items-center justify-between px-4 bg-card">
        <h1 className="text-xl font-semibold">SimpleSQL</h1>
        <div className="flex items-center gap-2">
          <Button 
            size="sm" 
            variant="outline"
            className="h-8 px-3 text-xs"
            onClick={() => setShowIntroSimpleSyntax(true)} 
            title="Try SimpleSyntax"
          >
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            Try SimpleSyntax
          </Button>
          <Button
            size="sm"
            variant={learnModeEnabled ? 'default' : 'outline'}
            className="h-8 px-3 text-xs"
            onClick={toggleLearnMode}
            title="Toggle Learn Mode"
          >
            <GraduationCap className="h-3.5 w-3.5 mr-1.5" />
            Learn Mode {learnModeEnabled ? 'On' : 'Off'}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setShowSavedQueries(true)} title="Saved Queries">
            <img src={savedQueriesIcon} alt="" aria-hidden="true" className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setShowHelp(true)} title="Help">
            <img src={helpIcon} alt="" aria-hidden="true" className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={toggleTheme} title="Toggle Theme">
            {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setShowSettings(true)} title="Settings">
            <img src={settingsIcon} alt="" aria-hidden="true" className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => openWizard()}>
            <img src={importIcon} alt="" aria-hidden="true" className="h-4 w-4 mr-2" />
            Import
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowConnectionHub(true)}>
            <img src={connectionIcon} alt="" aria-hidden="true" className="h-4 w-4 mr-2" />
            Switch Connection
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Database Explorer */}
        <aside className="w-64 border-r border-border bg-card overflow-y-auto">
          <DatabaseExplorer />
        </aside>

        <div className="flex-1 flex overflow-hidden">
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

          {learnModeEnabled && (
            <aside className="w-[390px] border-l border-border bg-card">
              <LearnModePanel />
            </aside>
          )}
        </div>
      </div>

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
      <Toaster position="top-right" />
    </div>
  );
}

export default App;
