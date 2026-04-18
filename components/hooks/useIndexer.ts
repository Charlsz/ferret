'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { WorkerMessage, IndexerProgressPayload } from '@/workers/types';
import type { ConnectedDirectory } from '@/lib/fs/types';

/**
 * hooks/useIndexer.ts
 *
 * Manages the Web Worker responsible for background reading and indexing.
 * Prevents the main UI thread from freezing.
 */
export function useIndexer() {
  const [isIndexing, setIsIndexing] = useState(false);
  const [progress, setProgress] = useState<IndexerProgressPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    // Lazy initialize worker to support Next.js SSR gracefully
    if (typeof window !== 'undefined') {
      workerRef.current = new Worker(new URL('../../workers/indexer.worker.ts', import.meta.url), {
        type: 'module',
      });

      workerRef.current.onmessage = (event: MessageEvent<WorkerMessage<IndexerProgressPayload | string>>) => {
        const { type, payload } = event.data;

        switch (type) {
          case 'INDEX_START':
            setIsIndexing(true);
            setProgress(null);
            setError(null);
            break;
          case 'INDEX_PROGRESS':
          case 'INDEX_COMPLETE':
            setProgress(payload as IndexerProgressPayload);
            if (type === 'INDEX_COMPLETE') {
              setIsIndexing(false);
              // Clean up or keep worker alive for the next directory
            }
            break;
          case 'INDEX_ERROR':
            setError(payload as string);
            setIsIndexing(false);
            break;
        }
      };
    }

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const startIndexing = useCallback((dir: ConnectedDirectory) => {
    if (workerRef.current) {
      workerRef.current.postMessage({
        handle: dir.handle,
        directoryId: dir.id,
      });
    } else {
      setError('Wait for worker to initialize.');
    }
  }, []);

  return { isIndexing, progress, error, startIndexing };
}
