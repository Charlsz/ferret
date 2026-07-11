'use client';

import { useEffect, useState } from 'react';
import type { LiteRTState, LiteRTAccelerator, LiteRTStatePayload, WorkerMessage } from '../workers/types';

/**
 * components/LiteRTStatusBadge.tsx
 *
 * A small indicator that shows the current LiteRT runtime status.
 * Listens to the 'ferret-litert-status' BroadcastChannel, which
 * litert.worker.ts broadcasts on every state transition.
 *
 * Displays:
 *   - A pulsing dot when loading
 *   - A WebGPU or WASM badge when ready
 *   - Silent (nothing) when not loaded yet
 *   - A muted error hint when in ERROR state
 */
export function LiteRTStatusBadge() {
  const [state, setState] = useState<LiteRTState>('NOT_LOADED');
  const [accelerator, setAccelerator] = useState<LiteRTAccelerator>('wasm');

  useEffect(() => {
    const channel = new BroadcastChannel('ferret-litert-status');

    channel.onmessage = (event: MessageEvent<WorkerMessage<LiteRTStatePayload>>) => {
      if (event.data.type === 'LITERT_STATE_CHANGE' && event.data.payload) {
        setState(event.data.payload.state);
        if (event.data.payload.accelerator) {
          setAccelerator(event.data.payload.accelerator);
        }
      }
    };

    return () => channel.close();
  }, []);

  if (state === 'NOT_LOADED') return null;

  if (state === 'LOADING') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-zinc-400 font-mono">
        <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-pulse" />
        LiteRT loading…
      </span>
    );
  }

  if (state === 'ERROR') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-red-400 font-mono">
        <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
        LiteRT error
      </span>
    );
  }

  // READY or RUNNING
  const isGPU = accelerator === 'webgpu';
  return (
    <span
      title={`LiteRT inference running on ${isGPU ? 'WebGPU' : 'WASM CPU'}`}
      className={`inline-flex items-center gap-1.5 text-xs font-mono px-2 py-0.5 rounded-full border ${
        isGPU
          ? 'text-violet-600 border-violet-200 bg-violet-50'
          : 'text-zinc-500 border-zinc-200 bg-zinc-50'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${
        state === 'RUNNING' ? 'animate-pulse' : ''
      } ${isGPU ? 'bg-violet-500' : 'bg-zinc-400'}`} />
      {isGPU ? 'WebGPU' : 'WASM'}
    </span>
  );
}
