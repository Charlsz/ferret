'use client';

import { useState } from 'react';
import { requestDirectoryAccess } from '@/lib/fs/directory';
import type { ConnectedDirectory } from '@/lib/fs/types';

/**
 * components/WorkspaceManager.tsx
 *
 * Client element handling user permissions to folders.
 * Adheres to "thin visual component" rule.
 */
export function WorkspaceManager() {
  const [directories, setDirectories] = useState<ConnectedDirectory[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    try {
      setError(null);
      const dir = await requestDirectoryAccess();
      if (dir) {
        // Prevent visual duplicates by name (for this early phase)
        setDirectories((prev) => {
          if (prev.some((d) => d.handle.name === dir.handle.name)) return prev;
          return [...prev, dir];
        });
        
        // Next phase (Phase 3) will map this interaction into IndexedDB 
        // to persist between browser sessions.
      }
    } catch (err: any) {
      setError(err.message || 'Failed to connect directory. Make sure you are using a compatible browser.');
    }
  };

  const handleDisconnect = (id: string) => {
    setDirectories(directories.filter(d => d.id !== id));
    // Next phase: will also trigger cleanup in IndexedDB.
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
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition shadow-sm"
        >
          Add Folder
        </button>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-md mb-4">{error}</p>}

      {directories.length === 0 ? (
        <div className="text-center py-6 bg-gray-50 border border-dashed border-gray-300 rounded-lg">
          <p className="text-sm text-gray-500 italic">No workspaces connected.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {directories.map((dir) => (
            <li key={dir.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-300 transition">
              <div className="flex flex-col">
                <span className="font-medium text-gray-800 font-mono text-sm">{dir.name}/</span>
                <span className="text-xs text-gray-500 mt-1">
                  Authorized at: {new Date(dir.connectedAt).toLocaleTimeString()}
                </span>
              </div>
              <button 
                onClick={() => handleDisconnect(dir.id)}
                className="text-sm text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-md transition"
              >
                Disconnect
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
