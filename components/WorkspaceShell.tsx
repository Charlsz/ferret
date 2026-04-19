'use client';

import { useState, useEffect } from 'react';
import { WorkspaceManager } from './WorkspaceManager';
import { SearchUI } from './SearchUI';
import { AIExplainer } from './AIExplainer';
import { FileViewer } from './FileViewer';
import { SystemControls } from './SystemControls';

export function WorkspaceShell() {
  const [selectedFile, setSelectedFile] = useState<{ id: string; name: string } | null>(null);
  
  // Hack for now until Workspace context hook is built
  const isConnected = true;

  // Expose a global hook for the AI to "intercept" and open files
  useEffect(() => {
    const handleAINeedsFile = (e: CustomEvent) => {
      setSelectedFile({ id: e.detail.id, name: e.detail.name });
    };
    window.addEventListener('ferret:open-file', handleAINeedsFile as EventListener);
    return () => window.removeEventListener('ferret:open-file', handleAINeedsFile as EventListener);
  }, []);

  return (
    <div className="flex h-screen w-full bg-zinc-50 text-zinc-900 font-sans overflow-hidden">
      {/* Left Pane: AI Chat */}
      <div className="w-[380px] flex-shrink-0 border-r border-zinc-200 bg-white flex flex-col z-10">
        <div className="px-4 py-3 border-b border-zinc-200 bg-white z-20 flex justify-between items-center">
          <h1 className="text-sm font-semibold text-zinc-800">
            Ferret Chat
          </h1>
        </div>
        <div className="flex-1 overflow-hidden p-4">
          <AIExplainer selectedFile={selectedFile} />
        </div>
      </div>

      {/* Right Pane: Context Area */}
      <div className="flex-1 flex flex-col h-full bg-white relative overflow-hidden">
        {!isConnected ? (
          /* Onboarding State */
          <div className="h-full flex items-center justify-center bg-zinc-50">
             <div className="max-w-md text-center p-8 rounded-xl border border-zinc-200 bg-white shadow-sm">
               <h2 className="text-lg font-semibold text-zinc-800 mb-2">Connect a workspace</h2>
               <p className="text-sm text-zinc-500 mb-6">Ferret reads your files locally to help you code. Nothing leaves your browser.</p>
               <WorkspaceManager />
             </div>
          </div>
        ) : selectedFile ? (
          /* File Viewer State */
          <div className="flex flex-col h-full w-full">
            <div className="h-[44px] bg-white border-b border-zinc-200 flex items-center justify-between px-4 text-sm flex-shrink-0 z-10">
               <div className="flex items-center gap-3">
                 <button 
                   onClick={() => setSelectedFile(null)}
                   className="text-zinc-500 hover:text-zinc-900 transition flex items-center gap-1 group font-medium"
                 >
                   <svg className="w-4 h-4 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
                   Back to folder
                 </button>
                 <span className="text-zinc-300">|</span>
                 <span className="text-zinc-700 font-mono text-xs">{selectedFile.name}</span>
               </div>
            </div>
            <div className="flex-1 overflow-hidden bg-[#1e1e1e]">
               <FileViewer selectedFile={selectedFile} />
            </div>
          </div>
        ) : (
          /* Missing selected file state - list files */
          <div className="flex-1 overflow-y-auto p-8 w-full max-w-4xl mx-auto custom-scrollbar bg-white">
            <div className="mb-6 pb-4 border-b border-zinc-100">
              <h2 className="text-xl font-semibold text-zinc-800">Workspace</h2>
              <p className="text-sm text-zinc-500 mt-1">Search or select a file to chat with it.</p>
            </div>

            <div className="bg-zinc-50 rounded-xl border border-zinc-200 overflow-hidden shadow-sm mb-12">
              <SearchUI onSelectFile={setSelectedFile} selectedFile={selectedFile} />
            </div>

            <div className="flex justify-between items-end mb-4 border-b border-zinc-100 pb-2">
              <h3 className="text-sm font-semibold text-zinc-800">Connected Folders</h3>
            </div>
            <WorkspaceManager />
            
            <div className="mt-12 pt-6 border-t border-zinc-100 flex justify-end">
              <SystemControls />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}