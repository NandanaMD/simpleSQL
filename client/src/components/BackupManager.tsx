import { useState, useEffect } from 'react';
import { useConnectionStore } from '../stores/connectionStore';
import * as api from '../lib/api';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from './ui/dialog';
import { Button } from './ui/button';
import { Database, Download, Trash2, RefreshCw, Upload, Clock } from 'lucide-react';

interface BackupManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connectionId: string;
  database: string;
}

export function BackupManager({
  open,
  onOpenChange,
  connectionId,
  database,
}: BackupManagerProps) {
  const { connections } = useConnectionStore();
  const [backups, setBackups] = useState<api.BackupInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);

  const connection = connections.find((c) => c.id === connectionId);

  useEffect(() => {
    if (open) {
      loadBackups();
    }
  }, [open, connectionId, database]);

  const loadBackups = async () => {
    setIsLoading(true);
    try {
      const data = await api.listBackups(connectionId, database);
      setBackups(data);
    } catch (error) {
      toast.error('Failed to load backups');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateBackup = async () => {
    setIsCreatingBackup(true);
    try {
      const backup = await api.backupDatabase(connectionId, database);
      toast.success(`Backup created: ${backup.size}`);
      loadBackups();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Backup failed');
    } finally {
      setIsCreatingBackup(false);
    }
  };

  const handleRestore = async (backupFilename: string) => {
    if (
      !confirm(
        `⚠️ WARNING: This will overwrite the current database!\n\nRestore from backup: ${backupFilename}?`
      )
    ) {
      return;
    }

    try {
      await api.restoreDatabase(connectionId, database, backupFilename);
      toast.success('Database restored successfully. Reconnect to see changes.');
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Restore failed');
    }
  };

  const handleDownload = async (filename: string) => {
    try {
      await api.downloadBackup(filename);
      toast.success('Backup downloaded');
    } catch (error) {
      toast.error('Download failed');
    }
  };

  const handleDelete = async (filename: string) => {
    if (!confirm(`Delete backup: ${filename}?`)) return;

    try {
      await api.deleteBackup(filename);
      toast.success('Backup deleted');
      loadBackups();
    } catch (error) {
      toast.error('Failed to delete backup');
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Backup & Restore
          </DialogTitle>
          <DialogDescription>
            {connection?.name} / {database}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Available Backups</h3>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={loadBackups} disabled={isLoading}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
                <Button size="sm" onClick={handleCreateBackup} disabled={isCreatingBackup}>
                  <Database className="h-4 w-4 mr-2" />
                  {isCreatingBackup ? 'Creating...' : 'Create Backup'}
                </Button>
              </div>
            </div>

            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading backups...</div>
            ) : backups.length === 0 ? (
              <div className="text-center py-8">
                <Database className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                <p className="text-muted-foreground">No backups yet. Create your first one!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {backups.map((backup) => (
                  <div
                    key={backup.filename}
                    className="border rounded-lg p-3 hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Database className="h-4 w-4 text-muted-foreground" />
                          <span className="font-mono text-sm">{backup.filename}</span>
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDate(backup.createdAt)}
                          </span>
                          <span>{backup.size}</span>
                        </div>
                      </div>
                      <div className="flex gap-1 ml-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => handleRestore(backup.filename)}
                          title="Restore this backup"
                        >
                          <Upload className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => handleDownload(backup.filename)}
                          title="Download backup file"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => handleDelete(backup.filename)}
                          title="Delete backup"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
