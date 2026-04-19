'use client';

import { useState } from 'react';
import { purgeAllData } from '@/lib/db/index';

/**
 * components/SystemControls.tsx
 *
 * Implements the "Panic Button / Zero Data Retention".
 * Displays an explicit modal detailing exactly what will be removed,
 * ensuring no "phantom persistence" or cache artifacts survive.
 */
export function SystemControls() {
  const [isPurging, setIsPurging] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const handleNukeData = async () => {
    setIsPurging(true);
    try {
      // Wipes IDB + Cache API (WebLLM models ~1.6GB)
      await purgeAllData(true);
      
      // A hard reload flushes the workers entirely, kills the WebGPU memory binding instantly, 
      // and resets the UI state flawlessly without over-engineering complex cleanup pipes.
      window.location.reload();
    } catch (err) {
      console.error('Failed to purge data:', err);
      alert('Failed to completely erase local data. Please refresh and try again.');
      setIsPurging(false);
      setShowModal(false);
    }
  };

  return (
    <>
      <div className="mt-16 pt-8 border-t border-gray-200">
        <div className="flex flex-col sm:flex-row justify-between items-center text-sm gap-4">
          <div>
            <p className="text-gray-500">
              <span className="font-semibold text-gray-700">Deep Local Design:</span> Ferret uses zero remote telemetry or tracking.
            </p>
          </div>
          <button 
            onClick={() => setShowModal(true)}
            disabled={isPurging}
            className="flex items-center text-red-600 hover:text-red-700 hover:bg-red-50 transition px-3 py-1.5 rounded-md disabled:opacity-50"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
            Clear All Local Data
          </button>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 text-left transform transition-all">
            <div className="flex items-center gap-3 mb-4 text-red-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
              <h3 className="text-xl font-bold">Hard Reset Ferret</h3>
            </div>
            
            <p className="text-gray-600 text-sm mb-4">
              This will permanently destroy all local data on this browser, requiring a full re-initialization on your next visit. The following will be deleted:
            </p>
            
            <ul className="text-sm text-gray-700 bg-red-50 rounded-lg p-4 space-y-2 mb-6 border border-red-100">
              <li className="flex items-start gap-2">
                <span className="text-red-500 mt-0.5">•</span>
                <strong>IndexedDB Workspace Index:</strong> All metadata and file chunks.
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-500 mt-0.5">•</span>
                <strong>Search History & State:</strong> MiniSearch index and selected files.
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-500 mt-0.5">•</span>
                <strong>File Permissions:</strong> Browser directory handle access grants.
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-500 mt-0.5">•</span>
                <strong>WebLLM Cache API artifacts:</strong> The ~1.6GB downloaded Qwen2.5-Coder model will be erased and must be re-downloaded later.
              </li>
            </ul>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                disabled={isPurging}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleNukeData}
                disabled={isPurging}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50 flex items-center justify-center min-w-[120px]"
              >
                {isPurging ? (
                  <span className="animate-pulse">Wiping...</span>
                ) : (
                  'Yes, Nuke Everything'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
