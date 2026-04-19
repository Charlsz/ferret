'use client';

import { useState } from 'react';
import { purgeAllData } from '@/lib/db/index';

/**
 * components/SystemControls.tsx
 *
 * Implements the "Panic Button / Zero Data Retention".
 * Displays an explicit modal detailing exactly what will be removed.
 */
export function SystemControls() {
  const [isPurging, setIsPurging] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const handleNukeData = async () => {
    setIsPurging(true);
    
    // Safety fallback: if wiping takes longer than 5 seconds, force reload anyway.
    const fallbackTimer = setTimeout(() => {
      window.location.reload();
    }, 5000);

    try {
      await purgeAllData(true);
      clearTimeout(fallbackTimer);
      window.location.reload();
    } catch (err) {
      console.error('Failed to purge data:', err);
      alert('Failed to completely erase local data. Please refresh and try again.');
      setIsPurging(false);
      setShowModal(false);
      clearTimeout(fallbackTimer);
    }
  };

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        disabled={isPurging}
        className="w-full text-left px-2 py-1.5 text-xs text-red-600 hover:bg-red-50 hover:text-red-700 rounded-md transition flex items-center"
      >
        <svg className="w-3.5 h-3.5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
        Clear All Cache & Data
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-5 text-left border border-zinc-200">
            <h3 className="text-base font-semibold text-zinc-900 mb-2">Clear completely?</h3>
            <p className="text-zinc-500 text-sm mb-4">
              This will destroy all local data on this browser, requiring a re-sync:
            </p>
            <ul className="text-xs text-zinc-600 bg-zinc-50 rounded pl-4 pr-3 py-3 space-y-1 mb-5 list-disc list-outside border border-zinc-100">
              <li>Uploaded folder metadata</li>
              <li>Downloaded AI Models (~1.6GB)</li>
              <li>Browser directory permissions</li>
            </ul>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowModal(false)}
                disabled={isPurging}
                className="px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleNukeData}
                disabled={isPurging}
                className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded flex items-center justify-center min-w-[80px] shadow-sm"
              >
                {isPurging ? 'Wiping...' : 'Clear All'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
