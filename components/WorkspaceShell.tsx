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
          <div className="flex items-center gap-2">
            <img src="/ferret.png" alt="Ferret" className="w-8 h-8 object-contain" />
            <h1 className="text-sm font-semibold text-zinc-800">
              Ferret
            </h1>
          </div>
          <a
            href="https://github.com/Charlsz/ferret"
            target="_blank"
            rel="noopener noreferrer"
            className="text-black"
            title="GitHub Repository"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
            </svg>
          </a>
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