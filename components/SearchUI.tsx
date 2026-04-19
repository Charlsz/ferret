'use client';

import { useState } from 'react';
import { useSearch } from './hooks/useSearch';
import { AIExplainer } from './AIExplainer';

/**
 * components/SearchUI.tsx
 *
 * Local Fast-Search component running completely in Web Workers with IDB.
 */
export function SearchUI() {
  const { isSearchReady, query, results, error, search } = useSearch();
  const [selectedFile, setSelectedFile] = useState<{ id: string, name: string } | null>(null);

  return (
    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 mt-8">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Local Unified Search</h2>
          <p className="text-sm text-gray-500 mt-1">Fuzzy search directly against the local indices using MiniSearch in Web Workers.</p>
        </div>
      </div>

      {!isSearchReady && (
        <div className="p-3 mb-4 text-sm text-yellow-800 bg-yellow-50 rounded-md">
          Starting indexer engine across folders...
        </div>
      )}

      {error && (
        <div className="p-3 mb-4 text-sm text-red-800 bg-red-50 rounded-md">
          {error}
        </div>
      )}

      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            search(e.target.value);
            setSelectedFile(null); // Reset selection when searching anew
          }}
          disabled={!isSearchReady}
          placeholder="Search by file name or content..."
          className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition disabled:bg-gray-100 disabled:cursor-not-allowed"
        />
      </div>

      {query && results.length === 0 && (
        <p className="text-center text-sm text-gray-500 mt-6 pb-2">No files matched.</p>
      )}

      {results.length > 0 && !selectedFile && (
        <div className="mt-6 border-t border-gray-100 pt-4">
          <ul className="space-y-3">
            {results.map((res) => (
              <li 
                key={res.id} 
                onClick={() => setSelectedFile({ id: res.id, name: res.name })}
                className="p-3 flex justify-between items-start bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 hover:border-gray-300 transition cursor-pointer"
              >
                <div>
                  <h3 className="font-semibold text-blue-700 hover:underline">{res.name}</h3>
                  <p className="text-xs font-mono text-gray-500 mt-1">{res.relativePath}</p>
                </div>
                <div className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded shadow-sm">
                  Score: {res.score.toFixed(1)}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {selectedFile && (
        <div className="mt-6 border-t border-gray-100 pt-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-medium text-gray-800 bg-gray-100 px-3 py-1 rounded inline-block">
              Selected: {selectedFile.name}
            </h3>
            <button 
              onClick={() => setSelectedFile(null)}
              className="text-xs text-gray-500 hover:text-gray-800 transition underline underline-offset-4"
            >
              Back to results
            </button>
          </div>
          
          <AIExplainer fileId={selectedFile.id} fileName={selectedFile.name} />
        </div>
      )}
    </div>
  );
}
