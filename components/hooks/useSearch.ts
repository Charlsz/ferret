'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { WorkerMessage, SearchRequestPayload, SearchResultItem } from '@/workers/types';

/**
 * hooks/useSearch.ts
 *
 * Spawns the dedicated Web Worker for MiniSearch and manages 
 * debouncing requests and returning local fuzzy search results.
 */
export function useSearch() {
  const [isSearchReady, setIsSearchReady] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Lazy init the Search worker securely traversing the import.meta.url
      workerRef.current = new Worker(new URL('../../workers/search.worker.ts', import.meta.url), {
        type: 'module',
      });

      workerRef.current.onmessage = (event: MessageEvent<WorkerMessage<any>>) => {
        const { type, payload } = event.data;

        switch (type) {
          case 'SEARCH_READY':
            setIsSearchReady(payload);
            break;
          case 'SEARCH_RESULTS':
            setResults(payload);
            break;
          case 'SEARCH_ERROR':
            setError(payload);
            break;
        }
      };
    }

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const search = useCallback((q: string) => {
    setQuery(q);
    setError(null);
    if (!workerRef.current) return;

    if (!q.trim()) {
      setResults([]);
      return;
    }

    workerRef.current.postMessage({
      type: 'SEARCH_REQUEST',
      payload: { query: q, limit: 30 }
    } as WorkerMessage<SearchRequestPayload>);
  }, []);

  return { isSearchReady, query, results, error, search };
}
