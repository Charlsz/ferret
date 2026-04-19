'use client';

import { useState, useEffect } from 'react';
import { requestDirectoryAccess, verifyPermission } from '@/lib/fs/directory';
import type { ConnectedDirectory } from '@/lib/fs/types';
import { getDirectories, saveDirectory, removeDirectory } from '@/lib/db/index';
import { useIndexer } from '@/components/hooks/useIndexer';

/**
 * components/WorkspaceManager.tsx
 *
 * Client element handling user permissions to folders.
 * Displays connection state and triggers background indexing gracefully.
 */
export function WorkspaceManager({ compact }: { compact?: boolean }) {
  const [directories, setDirectories] = useState<ConnectedDirectory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { isIndexing, progress, error: indexError, startIndexing } = useIndexer();

  useEffect(() => {
    const loadSavedWorkspaces = async () => {
      try {
        const savedDirs = await getDirectories();
        setDirectories(savedDirs);
      } catch (err: any) {
        console.error('Failed restoring workspaces:', err);
      } finally {
        setLoading(false);
      }
    };
    loadSavedWorkspaces();
  }, []);

  const handleConnect = async () => {
    try {
      setError(null);
      const dir = await requestDirectoryAccess();
      if (dir) {
        if (directories.some((d) => d.handle.name === dir.handle.name)) return;
        await saveDirectory(dir);
        setDirectories((prev) => [...prev, dir]);
        startIndexing(dir);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to connect directory.');
    }
  };

  const handleDisconnect = async (id: string, name: string) => {
    if (confirm(`Remove the workspace "${name}"? This removes all local data indexed.`)) {
      await removeDirectory(id);
      setDirectories(directories.filter(d => d.id !== id));
    }
  };

  const handleSyncDirectory = async (dir: ConnectedDirectory) => {
    try {
      const hasPermission = await verifyPermission(dir.handle, true);
      if (hasPermission) {
        startIndexing(dir);
      } else {
        setError(`Access Expired. Re-add the folder.`);
      }
    } catch (err: any) {
      console.error('Failed to verify permissions:', err);
      setError(`Storage Error or Expired Handle. Re-add the folder.`);
    }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        {(error || indexError) && <span className="text-xs text-red-600">{error || indexError}</span>}
        <button
          onClick={handleConnect}
          disabled={isIndexing}
          className="px-3 py-1.5 bg-zinc-900 text-white text-xs font-medium rounded hover:bg-zinc-800 transition disabled:bg-zinc-300"
        >
          {isIndexing ? 'Indexing...' : 'Connect folder'}
        </button>
      </div>
    );
  }

  return (
    <div className="w-full">
      {!directories.length && (
        <div className="text-center py-6">
          <button
            onClick={handleConnect}
            disabled={isIndexing}
            className="px-6 py-3 bg-zinc-900 text-white text-sm font-medium rounded-lg hover:bg-zinc-800 transition shadow-sm disabled:bg-zinc-300 w-full"
          >
            {isIndexing ? 'Indexing Workspace...' : 'Choose folder'}
          </button>
        </div>
      )}

      {(error || indexError) && (
        <p className="text-sm text-red-600 bg-red-50 p-3 rounded-md mb-4 text-left border border-red-100">
          <span className="font-semibold mr-2">Error:</span> {error || indexError}
        </p>
      )}

      {loading && (
        <div className="text-center py-4">
          <p className="text-xs text-zinc-500 animate-pulse">Loading workspaces...</p>
        </div>
      )}

      {directories.length > 0 && (
        <div className="space-y-3 pt-2">
          <ul className="space-y-3 pb-2 border-b border-zinc-100">
            {directories.map((dir) => (
              <li key={dir.id} className="flex justify-between items-center px-4 py-3 bg-white rounded-xl border border-zinc-200 transition">
                <div className="flex flex-col w-1/2">
                  <span className="font-medium text-zinc-800 font-mono text-sm break-all">{dir.name}/</span>
                  <span className="text-[10px] text-zinc-500 mt-1">
                    Added {new Date(dir.connectedAt).toLocaleDateString()}
                  </span>

                  {isIndexing && progress && (
                    <div className="mt-2 flex flex-col gap-1 w-full max-w-sm">
                      <span className="text-xs text-blue-600 animate-pulse">
                        Indexing... {progress.processed}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleSyncDirectory(dir)}
                    disabled={isIndexing}
                    className="text-xs text-zinc-600 hover:text-zinc-900 border border-zinc-200 hover:bg-zinc-50 px-3 py-1.5 rounded transition disabled:opacity-50"
                  >
                    Sync
                  </button>
                  <button
                    onClick={() => handleDisconnect(dir.id, dir.name)}
                    disabled={isIndexing}
                    className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-100 px-3 py-1.5 rounded transition disabled:opacity-50"
                  >
                    Disconnect
                  </button>
                </div>
              </li>
            ))}
          </ul>
          
          <div className="flex justify-end pt-1">
            <button
              onClick={handleConnect}
              disabled={isIndexing}
              className="text-xs text-zinc-600 hover:text-zinc-900 font-medium flex items-center bg-white px-3 py-1.5 rounded border border-zinc-200 hover:bg-zinc-50 transition shadow-sm disabled:opacity-50"
            >
              <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
              Add folder
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
