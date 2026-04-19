'use client';

import { useState, useRef, useEffect } from 'react';
import { useAIExplainer } from './hooks/useAIExplainer';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

function AIMessage({ content }: { content: string }) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      <ReactMarkdown 
        remarkPlugins={[remarkGfm]}
        components={{
          h3: ({node, ...props}) => <h3 className="mt-4 mb-2 text-sm font-semibold text-zinc-900" {...props} />,
          h4: ({node, ...props}) => <h4 className="mt-3 mb-1 text-sm font-semibold text-zinc-800" {...props} />,
          p: ({node, ...props}) => <p className="mb-2 last:mb-0 leading-relaxed text-zinc-700" {...props} />,
          ul: ({node, ...props}) => <ul className="pl-4 mb-2 list-disc text-zinc-700" {...props} />,
          ol: ({node, ...props}) => <ol className="pl-4 mb-2 list-decimal text-zinc-700" {...props} />,
          li: ({node, ...props}) => <li className="mb-1" {...props} />,
          code: ({node, inline, ...props}: any) => 
            inline ? (
              <code className="px-1 py-0.5 bg-zinc-200 text-zinc-800 rounded font-mono text-xs" {...props} />
            ) : (
              <div className="overflow-hidden rounded-md bg-zinc-900 my-2">
                <code className="block p-3 overflow-x-auto font-mono text-xs text-zinc-100" {...props} />
              </div>
            ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export function AIExplainer({ selectedFile }: { selectedFile: { id: string; name: string } | null }) {
  const { modelState, isModelCached, isInitializing, progress, isExplaining, explanation, error, explainFile } = useAIExplainer();
  const messages: any[] = []; // polyfill properly for now until worker is updated
  const [userPrompt, setUserPrompt] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, explanation, isExplaining, progress]);

  const stateColors: Record<string, string> = {
    'NOT_LOADED': 'text-zinc-500',
    'DOWNLOADING': 'text-amber-600 animate-pulse',
    'READY': 'text-emerald-600',
    'GENERATING': 'text-indigo-600 animate-pulse',
    'ERROR': 'text-red-600'
  };

  const handleExplain = () => {
    if (!selectedFile) return;
    explainFile(selectedFile.id, userPrompt);
    setUserPrompt('');
  };

  return (
    <div className="flex flex-col h-full relative">
      <div className="flex justify-between items-center mb-3 px-1 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-bold uppercase tracking-wider ${stateColors[modelState]}`}>
            {modelState === 'NOT_LOADED' && isModelCached ? 'OFFLINE READY' : modelState.replace('_', ' ')}
          </span>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 p-3 mb-4 rounded-md border border-red-100">
          <span className="font-semibold">Error:</span> {error}
        </p>
      )}

      {/* Main Dialogue Area */}
      <div className="flex-1 overflow-y-auto mb-4 rounded-xl flex flex-col space-y-4 custom-scrollbar px-1 pb-4">
        {(!messages || messages.length === 0) && !explanation && !isInitializing && (
          <div className="h-full flex flex-col justify-center items-center text-center text-zinc-500">
             {selectedFile ? (
                <>
                  <p className="text-sm text-zinc-700 font-medium">Ready to chat about</p>
                  <p className="text-xs font-mono mt-1 bg-zinc-100 px-2 py-1 rounded">{selectedFile.name}</p>
                </>
             ) : (
                <p className="text-sm">Select a file to begin analyzing.</p>
             )}
          </div>
        )}

        {/* Render Conversation History (if hook supports it, falling back to explanation) */}
        {(messages || []).map((msg: any, i: number) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm ${
              msg.role === 'user' 
                ? 'bg-zinc-900 text-white rounded-br-sm' 
                : 'bg-zinc-100 text-zinc-900 rounded-bl-sm border border-zinc-200'
            }`}>
              {msg.role === 'user' ? (
                 <div className="whitespace-pre-wrap">{msg.content}</div>
              ) : (
                 <AIMessage content={msg.content} />
              )}
            </div>
          </div>
        ))}

        {!messages?.length && explanation && !isExplaining && (
           <div className="flex justify-start">
             <div className="max-w-[90%] bg-zinc-100 rounded-2xl rounded-bl-sm border border-zinc-200 px-4 py-3 text-sm">
                <div className="text-[10px] text-zinc-500 uppercase tracking-wide font-bold mb-2 pb-2 border-b border-zinc-200 flex justify-between">
                  <span>Ferret</span>
                  {selectedFile && <span className="font-mono lowercase normal-case">{selectedFile.name}</span>}
                </div>
                <AIMessage content={explanation.text} />
             </div>
           </div>
        )}

        {isInitializing && progress && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-2xl rounded-bl-sm px-4 py-3 bg-zinc-50 border border-zinc-200">
              <p className="text-xs font-medium text-zinc-600 animate-pulse">Loading Model to WebGPU...</p>
              <div className="w-full bg-zinc-200 rounded-full h-1.5 mt-2 overflow-hidden">
                <div className="bg-zinc-800 h-full transition-all duration-300" style={{ width: `${Math.round(progress.progress * 100)}%` }}></div>
              </div>
              <p className="text-[10px] text-zinc-500 mt-2 font-mono truncate">{progress.text}</p>
            </div>
          </div>
        )}

        {isExplaining && !isInitializing && (
          <div className="flex justify-start">
             <div className="bg-zinc-100 rounded-2xl rounded-bl-sm px-4 py-3 text-sm flex items-center gap-2 border border-zinc-200">
               <div className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce"></div>
               <div className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
               <div className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
             </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="flex flex-col gap-2 mt-auto p-2">
        <div className="relative flex items-end bg-white border border-zinc-200 rounded-xl shadow-sm focus-within:ring-2 focus-within:ring-zinc-800 transition-all">
          <textarea
            className="w-full bg-transparent pl-4 pr-12 py-3 min-h-[44px] max-h-32 outline-none text-sm placeholder:text-zinc-500 disabled:opacity-50 resize-none custom-scrollbar"
            placeholder={selectedFile ? "Ask about this file..." : "Select a file..."}
            value={userPrompt}
            onChange={(e) => {
              setUserPrompt(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = `${e.target.scrollHeight}px`;
            }}
            rows={1}
            disabled={!selectedFile || isExplaining || isInitializing}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && selectedFile && !isExplaining && !isInitializing) {
                e.preventDefault();
                handleExplain();
                e.currentTarget.style.height = 'auto';
              }
            }}
          />
          <button
            onClick={() => {
              handleExplain();
              const ta = document.querySelector('textarea');
              if (ta) ta.style.height = 'auto';
            }}
            disabled={!selectedFile || isExplaining || isInitializing || !userPrompt.trim()}
            className="absolute right-2 bottom-2 p-1.5 bg-zinc-900 text-white rounded-md hover:bg-zinc-800 disabled:bg-zinc-100 disabled:text-zinc-400 disabled:cursor-not-allowed transition transform active:scale-95"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
          </button>
        </div>
        {selectedFile && (
          <div className="text-[10px] text-zinc-400 text-center">
            Context: <span className="font-mono">{selectedFile.name}</span>
          </div>
        )}
      </div>
    </div>
  );
}

