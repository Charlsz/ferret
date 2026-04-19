'use client';

import { useState, useEffect } from 'react';
import { useSearch } from './hooks/useSearch';
import { getAllFilesMetadata } from '@/lib/db/index';

/**
 * components/SearchUI.tsx
 *
 * Local Fast-Search component running completely in Web Workers with IDB.
 */
export function SearchUI({ onSelectFile, selectedFile }: { onSelectFile: (file: { id: string, name: string } | null) => void, selectedFile: { id: string, name: string } | null }) {
  const { isSearchReady, query, results, error, search } = useSearch();
  const [allFiles, setAllFiles] = useState<{ id: string, name: string, relativePath: string, extension: string }[]>([]);

  // Automatically refresh the available files list when no search is active
  useEffect(() => {
    if (!query && !selectedFile) {
      getAllFilesMetadata().then((files) => setAllFiles(files)).catch(console.error);
    }
  }, [query, selectedFile, isSearchReady]);

  if (selectedFile) return null; // SearchUI hides itself when a file is selected in to new layout

  return (
    <div className="w-full bg-white rounded-xl shadow-sm border border-zinc-200">
      
      {!isSearchReady && (
        <div className="p-3 m-4 text-xs font-medium text-amber-700 bg-amber-50 rounded-md border border-amber-100 flex items-center gap-2">
          <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
          Warming up indexer across folders...
        </div>
      )}

      {error && (
        <div className="p-3 m-4 text-xs font-medium text-red-700 bg-red-50 rounded-md border border-red-100">
          {error}
        </div>
      )}

      <div className="relative p-4 border-b border-zinc-100 bg-zinc-50/50 rounded-t-xl">
        <svg className="w-4 h-4 absolute left-7 top-7 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
        <input
          type="text"
          value={query}
          onChange={(e) => {
            search(e.target.value);
            onSelectFile(null); // Reset selection when searching anew
          }}
          disabled={!isSearchReady}
          placeholder="Search by file name or content..."
          className="w-full pl-9 pr-4 py-2.5 bg-white border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-800 transition disabled:bg-zinc-50 disabled:cursor-not-allowed placeholder:text-zinc-400 font-medium shadow-sm"
        />
      </div>

      {query && results.length === 0 && (
        <p className="text-center text-sm text-zinc-500 py-8 italic bg-zinc-50/30">No files matched.</p>
      )}

      {/* Show all available files when there's no query */}
      {!query && allFiles.length > 0 && (
        <div className="p-2">
          <ul className="space-y-1 max-h-[50vh] overflow-y-auto px-2 custom-scrollbar">
            {allFiles.map((file) => (
              <li
                key={file.id}
                onClick={() => onSelectFile({ id: file.id, name: file.name })}
                className="p-3 flex justify-between items-center rounded-lg hover:bg-zinc-100 transition cursor-pointer group"
              >
                <div className="flex items-center gap-3 w-full min-w-0 pr-4">
                  <div className="flex-shrink-0 w-7 h-7 bg-zinc-100 border border-zinc-200 text-zinc-500 rounded flex items-center justify-center font-bold text-[10px] uppercase group-hover:bg-white transition" title={file.extension}>
                    {file.extension.replace('.', '').slice(0, 3) || 'TXT'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-medium text-zinc-700 text-sm group-hover:text-zinc-900 truncate font-mono">{file.name}</h3>
                    <p className="text-[10px] text-zinc-400 mt-0.5 truncate tracking-wide">{file.relativePath}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {results.length > 0 && (
        <div className="p-2">
          <ul className="space-y-1 max-h-[50vh] overflow-y-auto px-2 custom-scrollbar">
            {results.map((res) => (
              <li
                key={res.id}
                onClick={() => onSelectFile({ id: res.id, name: res.name })}
                className="p-3 flex justify-between items-center rounded-lg hover:bg-zinc-100 transition cursor-pointer group"
              >
                <div className="flex flex-col min-w-0 pr-4 flex-1">
                  <h3 className="font-medium text-zinc-800 text-sm truncate font-mono">{res.name}</h3>
                  <p className="text-[10px] text-zinc-400 mt-0.5 truncate tracking-wide">{res.relativePath}</p>
                </div>
                <div className="bg-zinc-100 border border-zinc-200 text-zinc-500 text-[10px] font-mono px-1.5 py-0.5 rounded shadow-sm opacity-0 group-hover:opacity-100 transition">
                  {Math.round(res.score)}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
