import { useEffect, useState } from 'react';
import type { ConnectionConfig } from '@sql-ide/shared';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import * as api from '../lib/api';
import { useConnectionStore } from '../stores/connectionStore';
import { useExplorerStore } from '../stores/explorerStore';
import { useSettingsStore } from '../stores/settingsStore';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';

interface ConnectionHubProps {
  onEnterWorkspace: (connectionId: string, database: string) => void;
}

const generateConnectionName = (): string => {
  const id = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `Connection ${id}`;
};

const getDefaultConnectionFormData = (): ConnectionConfig => ({
  name: generateConnectionName(),
  host: 'localhost',
  port: 5432,
  username: '',
  password: '',
  defaultDatabase: '',
});

export function ConnectionHub({ onEnterWorkspace }: ConnectionHubProps) {
  const { connections, loading, fetchConnections, addConnection, removeConnection } = useConnectionStore();
  const { removeConnection: removeExplorerConnection } = useExplorerStore();
  const { connection, updateConnectionSettings } = useSettingsStore();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [formData, setFormData] = useState<ConnectionConfig>(getDefaultConnectionFormData());
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [authConnectionId, setAuthConnectionId] = useState<string | null>(null);
  const [authDatabase, setAuthDatabase] = useState('');
  const [authConnectionName, setAuthConnectionName] = useState('');
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  useEffect(() => {
    if (showCreateForm) {
      setFormData(getDefaultConnectionFormData());
    }
  }, [showCreateForm]);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

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
    if (!formData.name || !formData.host || !formData.defaultDatabase) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsCreating(true);
    try {
      const newConnection = await api.createConnection(formData);
      addConnection(newConnection);
      setShowCreateForm(false);
      setFormData(getDefaultConnectionFormData());
      toast.success(`Connection "${newConnection.name}" created successfully`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create connection');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (connectionId: string, name: string) => {
    if (!confirm(`Are you sure you want to delete connection "${name}"?`)) {
      return;
    }

    try {
      await api.deleteConnection(connectionId);
      removeConnection(connectionId);
      removeExplorerConnection(connectionId);

      if (connection.lastUsedConnectionId === connectionId) {
        updateConnectionSettings({ lastUsedConnectionId: null });
      }

      toast.success(`Connection "${name}" deleted`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete connection');
    }
  };

  const handleOpenConnection = async (connectionId: string, database: string) => {
    const connectionToOpen = connections.find((item) => item.id === connectionId);
    if (!connectionToOpen) {
      toast.error('Connection not found');
      return;
    }

    try {
      if (connectionToOpen.requiresAuthentication) {
        setAuthConnectionId(connectionId);
        setAuthDatabase(database);
        setAuthConnectionName(connectionToOpen.name);
        setAuthUsername(connectionToOpen.username || '');
        setAuthPassword('');
        setAuthDialogOpen(true);
        return;
      }

      updateConnectionSettings({ lastUsedConnectionId: connectionId });
      onEnterWorkspace(connectionId, database);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Authentication failed');
    }
  };

  const closeAuthDialog = (force = false) => {
    if (isAuthenticating && !force) {
      return;
    }
    setAuthDialogOpen(false);
    setAuthConnectionId(null);
    setAuthDatabase('');
    setAuthConnectionName('');
    setAuthUsername('');
    setAuthPassword('');
  };

  const handleAuthenticateAndOpen = async () => {
    if (!authConnectionId) {
      toast.error('Connection not found');
      return;
    }

    setIsAuthenticating(true);
    try {
      await api.authenticateConnection(authConnectionId, {
        username: authUsername,
        password: authPassword,
      });

      updateConnectionSettings({ lastUsedConnectionId: authConnectionId });
      onEnterWorkspace(authConnectionId, authDatabase);
      closeAuthDialog(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Authentication failed');
    } finally {
      setIsAuthenticating(false);
    }
  };

  if (showCreateForm) {
    return (
      <div className="h-screen overflow-y-auto bg-background">
        <div className="mx-auto w-full max-w-5xl p-6 md:p-8">
          <Card>
            <CardHeader>
              <CardTitle>Create Connection</CardTitle>
              <CardDescription>Fill the database details first, then adjust server or credentials only if needed.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <div className="rounded-lg border border-border p-4 space-y-3">
                  <div>
                    <p className="text-sm font-semibold">1. Connection Identity</p>
                    <p className="text-xs text-muted-foreground">A name is already generated. Change it if you want.</p>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="name">Connection Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      placeholder="Auto-generated connection name"
                    />
                  </div>
                </div>

                <div className="rounded-lg border border-border p-4 space-y-3">
                  <div>
                    <p className="text-sm font-semibold">2. Database</p>
                    <p className="text-xs text-muted-foreground">Create a default db (MANDATORY)</p>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="database">Default Database *</Label>
                    <Input
                      id="database"
                      value={formData.defaultDatabase}
                      onChange={(e) => handleInputChange('defaultDatabase', e.target.value)}
                      placeholder="Enter database name (e.g. sales_db)"
                    />
                  </div>
                </div>

                <div className="rounded-lg border border-border p-4 space-y-3">
                  <div>
                    <p className="text-sm font-semibold">3. Server</p>
                    <p className="text-xs text-muted-foreground">Use defaults unless your environment requires custom values.</p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
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
                        onChange={(e) => handleInputChange('port', parseInt(e.target.value, 10) || 0)}
                        placeholder="5432"
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-border p-4 space-y-3">
                  <div>
                    <p className="text-sm font-semibold">4. Credentials</p>
                    <p className="text-xs text-muted-foreground">Add credentials only if your database requires authentication.</p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="username">Username</Label>
                      <Input
                        id="username"
                        value={formData.username}
                        onChange={(e) => handleInputChange('username', e.target.value)}
                        placeholder="Enter your username"
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
                </div>
              </div>

              <div className="flex flex-wrap justify-between gap-2 pt-2 border-t border-border">
                <Button
                  variant="outline"
                  onClick={() => {
                    closeAuthDialog(true);
                    setShowCreateForm(false);
                    setFormData(getDefaultConnectionFormData());
                  }}
                >
                  Back
                </Button>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={handleTest} disabled={isTesting}>
                    {isTesting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Test Connection
                  </Button>
                  <Button onClick={handleCreate} disabled={isCreating}>
                    {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create Connection
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="h-screen overflow-y-auto bg-background">
        <div className="mx-auto w-full max-w-6xl p-6 md:p-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Connection Hub</h1>
            <p className="text-sm text-muted-foreground">Select one connection to enter the SQL workspace.</p>
          </div>
          <Button
            onClick={() => {
              closeAuthDialog(true);
              setFormData(getDefaultConnectionFormData());
              setShowCreateForm(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            New Connection
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Saved Connections</CardTitle>
              <CardDescription>Click a connection card to open it.</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading connections...
                </div>
              ) : connections.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No saved connections yet. Click New Connection to get started.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {connections.map((conn) => {
                    const isLastUsed = connection.lastUsedConnectionId === conn.id;

                    return (
                      <div
                        key={conn.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          void handleOpenConnection(conn.id, conn.defaultDatabase);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            void handleOpenConnection(conn.id, conn.defaultDatabase);
                          }
                        }}
                        className="rounded-lg border border-border p-4 transition-colors hover:bg-accent/50"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="mb-1 flex flex-wrap items-center gap-2">
                              <p className="truncate font-medium">{conn.name}</p>
                              {isLastUsed && (
                                <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                                  Last used
                                </span>
                              )}
                            </div>
                            <p className="truncate text-sm text-muted-foreground">
                              {conn.username}@{conn.host}:{conn.port}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">Default DB: {conn.defaultDatabase}</p>
                          </div>

                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(conn.id, conn.name);
                            }}
                            title="Delete connection"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        </div>
      </div>

      <Dialog open={authDialogOpen} onOpenChange={(open) => (open ? setAuthDialogOpen(true) : closeAuthDialog())}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Authenticate Connection</DialogTitle>
            <DialogDescription>
              Enter credentials for {authConnectionName || 'the selected connection'}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="auth-username">Username</Label>
              <Input
                id="auth-username"
                value={authUsername}
                onChange={(e) => setAuthUsername(e.target.value)}
                placeholder="Enter username"
                disabled={isAuthenticating}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="auth-password">Password</Label>
              <Input
                id="auth-password"
                type="password"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                placeholder="Enter password"
                disabled={isAuthenticating}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void handleAuthenticateAndOpen();
                  }
                }}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => closeAuthDialog()} disabled={isAuthenticating}>
              Cancel
            </Button>
            <Button onClick={() => void handleAuthenticateAndOpen()} disabled={isAuthenticating}>
              {isAuthenticating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Open Connection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
