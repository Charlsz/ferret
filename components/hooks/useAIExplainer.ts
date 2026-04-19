'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { 
  WorkerMessage, 
  AIExplainRequestPayload, 
  AIExplainResponsePayload, 
  AIInitProgressPayload,
  AIModelState
} from '@/workers/types';

/**
 * hooks/useAIExplainer.ts
 *
 * Handles the lazy-loading of the WebLLM engine exclusively when the 
 * user specifically triggers an 'Explain' action. Runs entirely locally 
 * on WebGPU hardware. Tracks engine VRAM loading progress.
 */
export function useAIExplainer() {
  const [modelState, setModelState] = useState<AIModelState>('NOT_LOADED');
  const [isModelCached, setIsModelCached] = useState<boolean>(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [progress, setProgress] = useState<AIInitProgressPayload | null>(null);
  const [isExplaining, setIsExplaining] = useState(false);
  const [explanation, setExplanation] = useState<AIExplainResponsePayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    // Only spin up the worker in client-side (no SSR rendering of workers).
    if (typeof window !== 'undefined') {
      workerRef.current = new Worker(new URL('../../workers/ai.worker.ts', import.meta.url), {
        type: 'module',
      });

      workerRef.current.onmessage = (event: MessageEvent<WorkerMessage<any>>) => {
        const { type, payload } = event.data;

        switch (type) {
          case 'AI_CHECK_CACHE_RESPONSE':
            setIsModelCached(payload as boolean);
            break;
          case 'AI_STATE_CHANGE':
            setModelState(payload as AIModelState);
            break;
          case 'AI_INIT_PROGRESS':
            setIsInitializing(true);
            setProgress(payload);
            break;
          case 'AI_INIT_COMPLETE':
            setIsInitializing(false);
            setProgress(null);
            setIsModelCached(true); // If it initialized completely, it's definitely cached now
            break;
          case 'AI_EXPLAIN_RESPONSE':
            setIsExplaining(false);
            setExplanation(payload);
            break;
          case 'AI_EXPLAIN_ERROR':
            setIsInitializing(false);
            setIsExplaining(false);
            setError(payload);
            break;
        }
      };

      // Check if the model is already in cache on hook mount
      workerRef.current.postMessage({ type: 'AI_CHECK_CACHE' } as WorkerMessage<void>);
    }

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const explainFile = useCallback((fileId: string, customPrompt?: string) => {
    if (!workerRef.current) return;
    
    setError(null);
    setExplanation(null);
    setIsExplaining(true);
    
    workerRef.current.postMessage({
      type: 'AI_EXPLAIN_REQUEST',
      payload: { fileId, userPrompt: customPrompt }
    } as WorkerMessage<AIExplainRequestPayload>);
  }, []);

  return { modelState, isModelCached, isInitializing, progress, isExplaining, explanation, error, explainFile };
}
