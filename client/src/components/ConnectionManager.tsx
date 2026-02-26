import { useState } from 'react';
import { useConnectionStore } from '../stores/connectionStore';
import { useExplorerStore } from '../stores/explorerStore';
import * as api from '../lib/api';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import type { ConnectionConfig } from '@sql-ide/shared';
import { Loader2, Trash2 } from 'lucide-react';

interface ConnectionManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConnectionManager({ open, onOpenChange }: ConnectionManagerProps) {
  const { connections, addConnection, removeConnection } = useConnectionStore();
  const { addConnection: addExplorerConnection, removeConnection: removeExplorerConnection } =
    useExplorerStore();
  const [isCreating, setIsCreating] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [formData, setFormData] = useState<ConnectionConfig>({
    name: '',
    host: 'localhost',
    port: 5432,
    username: '',
    password: '',
    defaultDatabase: 'main',
  });

  const handleInputChange = (field: keyof ConnectionConfig, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleTest = async () => {
    setIsTesting(true);
    try {
      const result = await api.testConnection(formData);
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.error || 'Connection failed');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Test connection failed');
    } finally {
      setIsTesting(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.name || !formData.host || !formData.username || !formData.defaultDatabase) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsCreating(true);
    try {
      const connection = await api.createConnection(formData);
      addConnection(connection);
      addExplorerConnection(connection.id, connection.name);
      toast.success(`Connection "${connection.name}" created successfully`);

      // Reset form
      setFormData({
        name: '',
        host: 'localhost',
        port: 5432,
        username: 'postgres',
        password: '',
        defaultDatabase: 'postgres',
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create connection');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete connection "${name}"?`)) {
      return;
    }

    try {
      await api.deleteConnection(id);
      removeConnection(id);
      removeExplorerConnection(id);
      toast.success(`Connection "${name}" deleted`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete connection');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Connection Manager</DialogTitle>
          <DialogDescription>Manage your SQLite database connections</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6">
          {/* Existing Connections */}
          <div>
            <h3 className="text-sm font-medium mb-3">Existing Connections</h3>
            {connections.length === 0 ? (
              <p className="text-sm text-muted-foreground">No connections yet. Create one below.</p>
            ) : (
              <div className="space-y-2">
                {connections.map((conn) => (
                  <div
                    key={conn.id}
                    className="flex items-center justify-between p-3 border border-border rounded-md"
                  >
                    <div>
                      <p className="font-medium">{conn.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {conn.username}@{conn.host}:{conn.port}/{conn.defaultDatabase}
                      </p>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDelete(conn.id, conn.name)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Create New Connection */}
          <div>
            <h3 className="text-sm font-medium mb-3">Create New Connection</h3>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Connection Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="My Database"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="host">Host *</Label>
                  <Input
                    id="host"
                    value={formData.host}
                    onChange={(e) => handleInputChange('host', e.target.value)}
                    placeholder="localhost"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="port">Port *</Label>
                  <Input
                    id="port"
                    type="number"
                    value={formData.port}
                    onChange={(e) => handleInputChange('port', parseInt(e.target.value, 10))}
                    placeholder="5432"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="username">Username *</Label>
                  <Input
                    id="username"
                    value={formData.username}
                    onChange={(e) => handleInputChange('username', e.target.value)}
                    placeholder="(optional)"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => handleInputChange('password', e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="database">Default Database *</Label>
                <Input
                  id="database"
                  value={formData.defaultDatabase}
                  onChange={(e) => handleInputChange('defaultDatabase', e.target.value)}
                  placeholder="main"
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleTest} disabled={isTesting}>
            {isTesting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Test Connection
          </Button>
          <Button onClick={handleCreate} disabled={isCreating}>
            {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
