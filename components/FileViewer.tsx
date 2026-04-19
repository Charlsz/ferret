'use client';

import { useFileViewer } from './hooks/useFileViewer';

export function FileViewer({ selectedFile }: { selectedFile: { id: string; name: string } | null }) {
  const { content } = useFileViewer(selectedFile?.id);

  if (!selectedFile) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center text-center p-8 text-gray-500 font-mono text-sm opacity-60">
        <svg className="w-12 h-12 mb-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
        </svg>
        <p>Select a file from the workspace above to view its contents.</p>
        <p className="mt-1 text-xs">Files are fetched securely from the IndexedDB cache.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-900 border-t border-gray-800">
      <div className="flex flex-row justify-between items-center py-2 px-4 bg-gray-800 border-b border-gray-700 shadow-md z-10">
        <h4 className="text-gray-300 text-sm font-mono tracking-wide">{selectedFile.name}</h4>
        <span className="px-2 py-0.5 bg-green-900/50 text-green-300 text-[10px] uppercase font-bold rounded">
          Local Viewer
        </span>
      </div>
      <div className="flex-1 overflow-auto p-4 custom-scrollbar">
        {content ? (
          <pre className="text-emerald-400 text-xs font-mono whitespace-pre-wrap leading-relaxed selection:bg-emerald-900">
            {content}
          </pre>
        ) : (
          <span className="text-gray-500 animate-pulse text-sm flex items-center gap-2">
            Loading file from IndexedDB...
          </span>
        )}
      </div>
    </div>
  );
}