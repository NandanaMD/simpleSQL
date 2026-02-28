import { useState } from 'react';
import { useSettingsStore } from '../stores/settingsStore';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Settings2, Code2, Database, FileText, Zap } from 'lucide-react';
import { toast } from 'sonner';

interface SettingsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsPanel({ open, onOpenChange }: SettingsPanelProps) {
  const { editor, query, format, connection, updateEditorSettings, updateQuerySettings, updateFormatSettings, updateConnectionSettings, resetToDefaults } = useSettingsStore();

  const [localEditor, setLocalEditor] = useState(editor);
  const [localQuery, setLocalQuery] = useState(query);
  const [localFormat, setLocalFormat] = useState(format);
  const [localConnection, setLocalConnection] = useState(connection);

  const handleSave = () => {
    updateEditorSettings(localEditor);
    updateQuerySettings(localQuery);
    updateFormatSettings(localFormat);
    updateConnectionSettings(localConnection);
    toast.success('Settings saved successfully');
    onOpenChange(false);
  };

  const handleReset = () => {
    if (confirm('Reset all settings to defaults?')) {
      resetToDefaults();
      setLocalEditor(editor);
      setLocalQuery(query);
      setLocalFormat(format);
      setLocalConnection(connection);
      toast.success('Settings reset to defaults');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Preferences
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="editor" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="editor">
              <Code2 className="h-4 w-4 mr-2" />
              Editor
            </TabsTrigger>
            <TabsTrigger value="query">
              <Database className="h-4 w-4 mr-2" />
              Query
            </TabsTrigger>
            <TabsTrigger value="format">
              <FileText className="h-4 w-4 mr-2" />
              Format
            </TabsTrigger>
            <TabsTrigger value="connection">
              <Zap className="h-4 w-4 mr-2" />
              Connection
            </TabsTrigger>
          </TabsList>

          <TabsContent value="editor" className="space-y-4 mt-4">
            <div className="space-y-4">
              <div>
                <Label>Font Size</Label>
                <Input
                  type="number"
                  min="8"
                  max="32"
                  value={localEditor.fontSize}
                  onChange={(e) => setLocalEditor({ ...localEditor, fontSize: parseInt(e.target.value) })}
                />
              </div>
              <div>
                <Label>Tab Size</Label>
                <Input
                  type="number"
                  min="2"
                  max="8"
                  value={localEditor.tabSize}
                  onChange={(e) => setLocalEditor({ ...localEditor, tabSize: parseInt(e.target.value) })}
                />
              </div>
              <div>
                <Label>Font Family</Label>
                <Input
                  value={localEditor.fontFamily}
                  onChange={(e) => setLocalEditor({ ...localEditor, fontFamily: e.target.value })}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  checked={localEditor.minimap}
                  onCheckedChange={(checked) => setLocalEditor({ ...localEditor, minimap: checked as boolean })}
                />
                <Label>Show Minimap</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  checked={localEditor.lineNumbers}
                  onCheckedChange={(checked) => setLocalEditor({ ...localEditor, lineNumbers: checked as boolean })}
                />
                <Label>Show Line Numbers</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  checked={localEditor.wordWrap}
                  onCheckedChange={(checked) => setLocalEditor({ ...localEditor, wordWrap: checked as boolean })}
                />
                <Label>Word Wrap</Label>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="query" className="space-y-4 mt-4">
            <div className="space-y-4">
              <div>
                <Label>Query Timeout (seconds)</Label>
                <Input
                  type="number"
                  min="5"
                  max="300"
                  value={localQuery.timeout / 1000}
                  onChange={(e) => setLocalQuery({ ...localQuery, timeout: parseInt(e.target.value) * 1000 })}
                />
              </div>
              <div>
                <Label>Maximum Rows</Label>
                <Input
                  type="number"
                  min="100"
                  max="10000"
                  value={localQuery.maxRows}
                  onChange={(e) => setLocalQuery({ ...localQuery, maxRows: parseInt(e.target.value) })}
                />
              </div>
              <div>
                <Label>Fetch Size</Label>
                <Input
                  type="number"
                  min="10"
                  max="1000"
                  value={localQuery.fetchSize}
                  onChange={(e) => setLocalQuery({ ...localQuery, fetchSize: parseInt(e.target.value) })}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  checked={localQuery.autoSave}
                  onCheckedChange={(checked) => setLocalQuery({ ...localQuery, autoSave: checked as boolean })}
                />
                <Label>Auto-save Queries</Label>
              </div>
              {localQuery.autoSave && (
                <div>
                  <Label>Auto-save Interval (seconds)</Label>
                  <Input
                    type="number"
                    min="10"
                    max="300"
                    value={localQuery.autoSaveInterval}
                    onChange={(e) => setLocalQuery({ ...localQuery, autoSaveInterval: parseInt(e.target.value) })}
                  />
                </div>
              )}
              <div className="flex items-center space-x-2">
                <Checkbox
                  checked={localQuery.confirmDelete}
                  onCheckedChange={(checked) => setLocalQuery({ ...localQuery, confirmDelete: checked as boolean })}
                />
                <Label>Confirm DELETE Operations</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  checked={localQuery.confirmDrop}
                  onCheckedChange={(checked) => setLocalQuery({ ...localQuery, confirmDrop: checked as boolean })}
                />
                <Label>Confirm DROP Operations</Label>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="format" className="space-y-4 mt-4">
            <div className="space-y-4">
              <div>
                <Label>Date Format</Label>
                <Input
                  value={localFormat.dateFormat}
                  onChange={(e) => setLocalFormat({ ...localFormat, dateFormat: e.target.value })}
                  placeholder="YYYY-MM-DD"
                />
              </div>
              <div>
                <Label>Time Format</Label>
                <Input
                  value={localFormat.timeFormat}
                  onChange={(e) => setLocalFormat({ ...localFormat, timeFormat: e.target.value })}
                  placeholder="HH:mm:ss"
                />
              </div>
              <div>
                <Label>Number Precision</Label>
                <Input
                  type="number"
                  min="0"
                  max="10"
                  value={localFormat.numberPrecision}
                  onChange={(e) => setLocalFormat({ ...localFormat, numberPrecision: parseInt(e.target.value) })}
                />
              </div>
              <div>
                <Label>NULL Display</Label>
                <Input
                  value={localFormat.nullDisplay}
                  onChange={(e) => setLocalFormat({ ...localFormat, nullDisplay: e.target.value })}
                  placeholder="NULL"
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="connection" className="space-y-4 mt-4">
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  checked={localConnection.autoReconnect}
                  onCheckedChange={(checked) => setLocalConnection({ ...localConnection, autoReconnect: checked as boolean })}
                />
                <Label>Auto-reconnect on Connection Loss</Label>
              </div>
              {localConnection.autoReconnect && (
                <>
                  <div>
                    <Label>Reconnect Attempts</Label>
                    <Input
                      type="number"
                      min="1"
                      max="10"
                      value={localConnection.reconnectAttempts}
                      onChange={(e) => setLocalConnection({ ...localConnection, reconnectAttempts: parseInt(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label>Reconnect Delay (seconds)</Label>
                    <Input
                      type="number"
                      min="1"
                      max="30"
                      value={localConnection.reconnectDelay / 1000}
                      onChange={(e) => setLocalConnection({ ...localConnection, reconnectDelay: parseInt(e.target.value) * 1000 })}
                    />
                  </div>
                </>
              )}
              <div>
                <Label>Connection Timeout (seconds)</Label>
                <Input
                  type="number"
                  min="5"
                  max="60"
                  value={localConnection.connectionTimeout}
                  onChange={(e) => setLocalConnection({ ...localConnection, connectionTimeout: parseInt(e.target.value) })}
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-between mt-4 pt-4 border-t">
          <Button variant="outline" onClick={handleReset}>
            Reset to Defaults
          </Button>
          <div className="space-x-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Save Changes</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
