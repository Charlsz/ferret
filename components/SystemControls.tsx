'use client';

import { useState } from 'react';
import { purgeAllData } from '@/lib/db/index';

/**
 * components/SystemControls.tsx
 *
 * Implements the "Panic Button / Zero Data Retention".
 * Instantly obliterates local DB allocations, forces a state reset,
 * and clears the VRAM context by destroying the browser tab's active JS context via reload.
 */
export function SystemControls() {
  const [isPurging, setIsPurging] = useState(false);

  const handleNukeData = async () => {
    const confirmMsg = "Are you absolutely sure?\n\nThis will DELETE all local indices, disconnected folders, AI cached responses, and reset Ferret completely. This action cannot be recovered.";
    
    if (window.confirm(confirmMsg)) {
      setIsPurging(true);
      try {
        await purgeAllData();
        // A hard reload flushes the workers entirely, kills the WebGPU memory binding instantly, 
        // and resets the UI state flawlessly without over-engineering complex cleanup pipes.
        window.location.reload();
      } catch (err) {
        console.error('Failed to purge data:', err);
        alert('Failed to completely erase local data. Please refresh and try again.');
        setIsPurging(false);
      }
    }
  };

  return (
    <div className="mt-16 pt-8 border-t border-gray-200">
      <div className="flex flex-col sm:flex-row justify-between items-center text-sm gap-4">
        <div>
           <p className="text-gray-500">
             <span className="font-semibold text-gray-700">Deep Local Design:</span> Ferret uses zero remote telemetry or tracking.
           </p>
        </div>
        <button 
          onClick={handleNukeData}
          disabled={isPurging}
          className="flex items-center text-red-600 hover:text-red-700 hover:bg-red-50 transition px-3 py-1.5 rounded-md disabled:opacity-50"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
          {isPurging ? 'Purging System...' : 'Wipe All Data & State'}
        </button>
      </div>
    </div>
  );
}
