import { useState, useEffect } from 'react';
import { useSavedQueriesStore } from '../stores/savedQueriesStore';
import { useEditorStore } from '../stores/editorStore';
import { useConnectionStore } from '../stores/connectionStore';
import * as api from '../lib/api';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  BookOpen,
  Plus,
  Search,
  Folder,
  FileText,
  Play,
  Edit2,
  Trash2,
  Save,
  Tag,
} from 'lucide-react';

interface SavedQueriesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SavedQueriesDialog({ open, onOpenChange }: SavedQueriesDialogProps) {
  const {
    savedQueries,
    setSavedQueries,
    addSavedQuery,
    updateSavedQueryInStore,
    removeSavedQuery,
    searchTerm,
    setSearchTerm,
    selectedFolder,
    setSelectedFolder,
    getFilteredQueries,
    getFolders,
  } = useSavedQueriesStore();

  const { createTab, updateTabContent } = useEditorStore();
  const { selectedConnectionId, selectedDatabase } = useConnectionStore();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingQuery, setEditingQuery] = useState<api.SavedQuery | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    sql: '',
    folder: '',
    tags: '',
  });

  useEffect(() => {
    if (open) {
      loadSavedQueries();
    }
  }, [open]);

  const loadSavedQueries = async () => {
    try {
      const queries = await api.getAllSavedQueries();
      setSavedQueries(queries);
    } catch (error) {
      toast.error('Failed to load saved queries');
    }
  };

  const handleCreateQuery = async () => {
    if (!formData.name || !formData.sql) {
      toast.error('Name and SQL are required');
      return;
    }

    try {
      const queryData = {
        name: formData.name,
        description: formData.description || undefined,
        sql: formData.sql,
        connectionId: selectedConnectionId || undefined,
        database: selectedDatabase || undefined,
        folder: formData.folder || undefined,
        tags: formData.tags ? formData.tags.split(',').map((t) => t.trim()) : undefined,
      };

      if (editingQuery) {
        const updated = await api.updateSavedQuery(editingQuery.id, queryData);
        updateSavedQueryInStore(updated.id, updated);
        toast.success('Query updated successfully');
      } else {
        const created = await api.createSavedQuery(queryData);
        addSavedQuery(created);
        toast.success('Query saved successfully');
      }

      setShowCreateDialog(false);
      setEditingQuery(null);
      setFormData({ name: '', description: '', sql: '', folder: '', tags: '' });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save query');
    }
  };

  const handleLoadQuery = (query: api.SavedQuery) => {
    const tabId = createTab(query.connectionId, query.database);
    updateTabContent(tabId, query.sql);
    toast.success(`Loaded: ${query.name}`);
    onOpenChange(false);
  };

  const handleEditQuery = (query: api.SavedQuery) => {
    setEditingQuery(query);
    setFormData({
      name: query.name,
      description: query.description || '',
      sql: query.sql,
      folder: query.folder || '',
      tags: query.tags?.join(', ') || '',
    });
    setShowCreateDialog(true);
  };

  const handleDeleteQuery = async (id: string) => {
    if (!confirm('Delete this saved query?')) return;

    try {
      await api.deleteSavedQuery(id);
      removeSavedQuery(id);
      toast.success('Query deleted');
    } catch (error) {
      toast.error('Failed to delete query');
    }
  };

  const filteredQueries = getFilteredQueries();
  const folders = getFolders();

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Saved Queries
            </DialogTitle>
          </DialogHeader>

          <div className="flex gap-4 flex-1 overflow-hidden">
            {/* Sidebar */}
            <div className="w-48 border-r pr-4 space-y-2 overflow-y-auto">
              <Button
                size="sm"
                className="w-full"
                onClick={() => {
                  setEditingQuery(null);
                  setFormData({ name: '', description: '', sql: '', folder: '', tags: '' });
                  setShowCreateDialog(true);
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                New Query
              </Button>

              <div className="pt-2">
                <div
                  className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-accent ${!selectedFolder ? 'bg-accent' : ''}`}
                  onClick={() => setSelectedFolder(null)}
                >
                  <FileText className="h-4 w-4" />
                  <span className="text-sm">All Queries</span>
                  <span className="text-xs text-muted-foreground ml-auto">{savedQueries.length}</span>
                </div>
              </div>

              {folders.length > 0 && (
                <div className="pt-2">
                  <div className="text-xs font-semibold text-muted-foreground px-2 mb-1">
                    FOLDERS
                  </div>
                  {folders.map((folder) => (
                    <div
                      key={folder}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-accent ${selectedFolder === folder ? 'bg-accent' : ''}`}
                      onClick={() => setSelectedFolder(folder)}
                    >
                      <Folder className="h-4 w-4" />
                      <span className="text-sm truncate">{folder}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="relative mb-4">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search queries..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>

              <div className="flex-1 overflow-y-auto space-y-2">
                {filteredQueries.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    {searchTerm
                      ? 'No queries match your search'
                      : 'No saved queries yet. Create your first one!'}
                  </div>
                ) : (
                  filteredQueries.map((query) => (
                    <div
                      key={query.id}
                      className="border rounded-lg p-3 hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold">{query.name}</h4>
                          {query.description && (
                            <p className="text-sm text-muted-foreground">{query.description}</p>
                          )}
                          <pre className="text-xs mt-2 p-2 bg-muted rounded overflow-x-auto max-h-24">
                            {query.sql}
                          </pre>
                          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                            {query.folder && (
                              <span className="flex items-center gap-1">
                                <Folder className="h-3 w-3" />
                                {query.folder}
                              </span>
                            )}
                            {query.tags && query.tags.length > 0 && (
                              <span className="flex items-center gap-1">
                                <Tag className="h-3 w-3" />
                                {query.tags.join(', ')}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1 ml-2">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => handleLoadQuery(query)}
                            title="Load in editor"
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => handleEditQuery(query)}
                            title="Edit"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => handleDeleteQuery(query.id)}
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingQuery ? 'Edit Query' : 'Save New Query'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="My Query"
              />
            </div>

            <div>
              <Label>Description</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description"
              />
            </div>

            <div>
              <Label>SQL *</Label>
              <textarea
                className="w-full min-h-32 p-2 border rounded-md font-mono text-sm"
                value={formData.sql}
                onChange={(e) => setFormData({ ...formData, sql: e.target.value })}
                placeholder="SELECT * FROM ..."
              />
            </div>

            <div>
              <Label>Folder</Label>
              <Input
                value={formData.folder}
                onChange={(e) => setFormData({ ...formData, folder: e.target.value })}
                placeholder="Optional folder name"
              />
            </div>

            <div>
              <Label>Tags (comma-separated)</Label>
              <Input
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                placeholder="reports, finance, daily"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateQuery}>
              <Save className="h-4 w-4 mr-2" />
              {editingQuery ? 'Update' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
