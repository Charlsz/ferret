'use client';

import { useAIExplainer } from './hooks/useAIExplainer';
import { useFileViewer } from './hooks/useFileViewer';

/**
 * components/AIExplainer.tsx
 *
 * Displays local AI file analysis. Only instantiates WebLLM VRAM
 * if a user requests explanation of a selected search result.
 * Implements a split-view (Code on the left, ML context on the right).
 */
export function AIExplainer({ fileId, fileName }: { fileId?: string; fileName?: string }) {
  const { modelState, isInitializing, progress, isExplaining, explanation, error, explainFile } = useAIExplainer();
  const { content } = useFileViewer(fileId);

  if (!fileId) return null;

  // Tiny State Badge Mapping
  const stateColors: Record<string, string> = {
    'NOT_LOADED': 'bg-gray-100 text-gray-500',
    'DOWNLOADING': 'bg-yellow-100 text-yellow-700 animate-pulse',
    'READY': 'bg-green-100 text-green-700',
    'GENERATING': 'bg-purple-100 text-purple-700 animate-pulse',
    'ERROR': 'bg-red-100 text-red-700'
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
      {/* LEFT COLUMN: RAW FILE SNIPPET */}
      <div className="bg-gray-900 border border-gray-800 p-4 rounded-xl shadow-inner flex flex-col h-[500px] relative">
         <div className="flex justify-between items-center mb-2 border-b border-gray-700 pb-2">
            <h4 className="text-gray-400 text-xs font-mono">{fileName}</h4>
            {/* Visual Source Chunk Badge */}
            {explanation?.sourceChunk && (
              <span className="text-[10px] bg-blue-900/50 text-blue-300 px-2 py-0.5 rounded font-mono">
                Lines {explanation.sourceChunk.startLine}-{explanation.sourceChunk.endLine} 
                {explanation.sourceChunk.isTruncated && ' (Truncated)'}
              </span>
            )}
         </div>
         <div className="flex-1 overflow-y-auto">
            {content ? (
               <pre className="text-gray-300 text-xs font-mono whitespace-pre-wrap leading-relaxed">
                  {content}
               </pre>
            ) : (
               <span className="text-gray-500 animate-pulse text-sm">Loading from IndexedDB Cache...</span>
            )}
         </div>
      </div>

      {/* RIGHT COLUMN: AI EXPLAINER */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 p-6 rounded-xl shadow-sm flex flex-col h-[500px]">
        <div className="flex justify-between items-center mb-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <h3 className="font-semibold text-blue-900">Ferret Intelligence</h3>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${stateColors[modelState]}`}>
              {modelState.replace('_', ' ')}
            </span>
          </div>
          {!isExplaining && !explanation && (
            <button 
              onClick={() => explainFile(fileId)}
              className="px-4 py-2 bg-blue-600 text-white text-[13px] font-medium rounded-lg hover:bg-blue-700 transition shadow-sm"
            >
              Analyze Offline
            </button>
          )}
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-100 p-3 rounded-md mb-4 flex items-center">
            <span className="font-semibold mr-2">LLM Error:</span> {error}
          </p>
        )}

        <div className="flex-1 overflow-y-auto pr-2 relative">
          {modelState === 'NOT_LOADED' && !explanation && !error && (
            <div className="h-full flex flex-col justify-center items-center text-center opacity-60">
              <svg className="w-10 h-10 mb-3 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
              <p className="text-sm text-blue-900 max-w-xs">Ferret performs all inference locally in the browser, with model assets downloaded once and reused from browser cache afterward.</p>
            </div>
          )}

          {isInitializing && progress && (
            <div className="p-4 bg-white border border-blue-100 rounded-lg">
              <p className="text-sm font-medium text-blue-800 animate-pulse">Initializing Local WebGPU Engine...</p>
              <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2 overflow-hidden relative">
                <div className="bg-blue-600 h-full transition-all duration-300 ease-out" style={{ width: `${Math.round(progress.progress * 100)}%` }}></div>
              </div>
              <p className="text-xs text-gray-500 mt-3 font-mono leading-relaxed truncate">
                {progress.text}
              </p>
            </div>
          )}

          {isExplaining && !isInitializing && (
            <div className="flex items-center space-x-3 p-4 bg-white rounded-lg border border-blue-100">
               <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
               <p className="text-sm text-blue-700">Running inference on chunks...</p>
            </div>
          )}

          {explanation && (
            <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm h-full flex flex-col relative prose prose-sm prose-blue max-w-none text-gray-800">
              <div className="flex-1 pb-10">
                {/* Format markdown headers injected by the new System Prompt */}
                {explanation.text.split('\n').map((line, idx) => {
                  if (line.startsWith('###')) {
                    return <h3 key={idx} className="font-bold text-gray-900 text-sm uppercase tracking-wider mt-4 mb-2">{line.replace(/#/g, '').trim()}</h3>;
                  }
                  if (line.startsWith('-')) {
                    return <li key={idx} className="ml-4 py-0.5 text-[13px]">{line.substring(1)}</li>;
                  }
                  return <p key={idx} className={line.length === 0 ? 'h-2' : 'my-1.5 text-[13px] leading-relaxed'}>{line}</p>;
                })}
              </div>
              
              {explanation.usage && (
                <div className="text-[10px] text-gray-400 absolute bottom-2 right-4 bg-white/90 px-2 py-1 rounded backdrop-blur">
                    {explanation.usage?.promptTokens} context | {explanation.usage?.completionTokens} gen 
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
