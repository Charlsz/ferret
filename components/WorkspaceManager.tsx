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
export function WorkspaceManager() {
  const [directories, setDirectories] = useState<ConnectedDirectory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const { isIndexing, progress, error: indexError, startIndexing } = useIndexer();

  // On mount, load directories previously granted access and saved in IndexedDB
  useEffect(() => {
    const loadSavedWorkspaces = async () => {
      try {
        const savedDirs = await getDirectories();
        // Check if Chrome/Edge still grant us re-access (browsers usually drop handles 
        // after user closes the tab, requiring prompt). Instead of asking on mount, 
        // we'll just display them, and ask right before doing any indexing.
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
        // Prevent duplicate folders
        if (directories.some((d) => d.handle.name === dir.handle.name)) {
          return;
        }
        
        // 1. Commit to IndexedDB
        await saveDirectory(dir);
        
        // 2. Update UI
        setDirectories((prev) => [...prev, dir]);

        // 3. Spawns Web Worker to index contents in the background
        startIndexing(dir);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to connect directory. Make sure you are using a compatible browser.');
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
      // Browsers often require manual interaction to re-grant permissions after refresh
      const hasPermission = await verifyPermission(dir.handle, true);
      if (hasPermission) {
        startIndexing(dir);
      } else {
        setError(`Permission denied to read folder: ${dir.name}`);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to verify permissions.');
    }
  };

  return (
    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
      <div className="flex justify-between items-center mb-5">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Connected Workspaces</h2>
          <p className="text-sm text-gray-500 mt-1">Read-only connection strictly to the folders you approve.</p>
        </div>
        <button 
          onClick={handleConnect}
          disabled={isIndexing}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition shadow-sm disabled:bg-blue-300"
        >
          {isIndexing ? 'Indexing...' : 'Add Folder'}
        </button>
      </div>

      {(error || indexError) && (
        <p className="text-sm text-red-600 bg-red-50 p-3 rounded-md mb-4 flex items-center">
          <span className="font-semibold mr-2">Error:</span> {error || indexError}
        </p>
      )}

      {loading ? (
        <div className="text-center py-6">
          <p className="text-sm text-gray-500">Loading workspaces...</p>
        </div>
      ) : directories.length === 0 ? (
        <div className="text-center py-6 bg-gray-50 border border-dashed border-gray-300 rounded-lg">
          <p className="text-sm text-gray-500 italic">No workspaces connected.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {directories.map((dir) => (
            <li key={dir.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-300 transition">
              <div className="flex flex-col w-1/2">
                <span className="font-medium text-gray-800 font-mono text-sm break-all">{dir.name}/</span>
                <span className="text-xs text-gray-500 mt-1">
                  Added on: {new Date(dir.connectedAt).toLocaleString()}
                </span>
                
                {isIndexing && progress && (
                  <div className="mt-2 flex flex-col gap-1 w-full max-w-sm">
                    <span className="text-xs text-blue-600 animate-pulse">
                      Indexing files... {progress.processed} processed {/* (total missing due to async geneartor) / {progress.total} */}
                    </span>
                    <span className="text-[10px] text-gray-400 truncate">
                      Reading {progress.currentFile || '...'}
                    </span>
                  </div>
                )}
              </div>
              
              <div className="flex gap-2">
                <button 
                  onClick={() => handleSyncDirectory(dir)}
                  disabled={isIndexing}
                  className="text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-3 py-1.5 rounded-md transition disabled:text-gray-400 disabled:hover:bg-transparent"
                >
                  Sync Index
                </button>
                <button 
                  onClick={() => handleDisconnect(dir.id, dir.name)}
                  disabled={isIndexing}
                  className="text-sm text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-md transition disabled:text-red-300 disabled:hover:bg-transparent"
                >
                  Disconnect
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
