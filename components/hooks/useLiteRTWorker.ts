'use client';

import { useEffect, useRef } from 'react';

/**
 * components/hooks/useLiteRTWorker.ts
 *
 * Spawns and manages the litert.worker.ts Web Worker for the lifetime of
 * WorkspaceShell. Acts as the single owner of the worker and bridges all
 * BroadcastChannel traffic in and out of it:
 *
 *   indexer.worker  --[ferret-litert-embed BroadcastChannel]-->  litert.worker
 *   ai.worker       --[ferret-litert-classify BroadcastChannel]-> litert.worker
 *   litert.worker   --[LITERT_CLASSIFY_RESPONSE]--> ferret-litert-classify-response
 *   litert.worker   --[LITERT_STATE_CHANGE]-------> ferret-litert-status
 *
 * Without this hook the worker is never instantiated, all BroadcastChannel
 * messages are silently dropped, and LiteRTStatusBadge stays permanently null.
 */
export function useLiteRTWorker() {
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const worker = new Worker(
      new URL('../../workers/litert.worker.ts', import.meta.url),
      { type: 'module' },
    );
    workerRef.current = worker;

    // Inbound channels — messages posted by other workers that need to reach
    // litert.worker.ts. We forward the raw MessageEvent data directly.
    const embedChannel = new BroadcastChannel('ferret-litert-embed');
    const classifyChannel = new BroadcastChannel('ferret-litert-classify');

    embedChannel.onmessage = (e) => worker.postMessage(e.data);
    classifyChannel.onmessage = (e) => worker.postMessage(e.data);

    // Outbound channels — responses from litert.worker.ts routed back to the
    // callers and to the status badge.
    const classifyResponseChannel = new BroadcastChannel('ferret-litert-classify-response');
    const statusChannel = new BroadcastChannel('ferret-litert-status');

    worker.onmessage = (e) => {
      const { type } = e.data ?? {};
      if (type === 'LITERT_CLASSIFY_RESPONSE') {
        classifyResponseChannel.postMessage(e.data);
      } else if (type === 'LITERT_STATE_CHANGE') {
        statusChannel.postMessage(e.data);
      }
      // LITERT_READY and LITERT_EMBED_RESPONSE are handled internally by
      // litert.worker.ts (embed vectors are persisted to IndexedDB directly).
    };

    // Kick off lazy init so the WASM runtime and models start loading in the
    // background while the user is still on the workspace screen.
    worker.postMessage({ type: 'LITERT_INIT' });

    return () => {
      worker.terminate();
      embedChannel.close();
      classifyChannel.close();
      classifyResponseChannel.close();
      statusChannel.close();
    };
  }, []);
}
