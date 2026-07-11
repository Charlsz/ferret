/**
 * workers/indexer.worker.ts
 *
 * Dedicated Web Worker for asynchronous file traversal and indexing.
 * Does not block the main UI thread during heavy text reading operations.
 *
 * After indexing each file, a LiteRT embedding request is dispatched via a
 * shared BroadcastChannel so litert.worker.ts can process it independently
 * and persist the resulting vector back to IndexedDB.
 */

import { traverseDirectory } from '../lib/fs/traverse';
import { getFile, saveFile } from '../lib/db/index';
import { APP_CONFIG } from '../config/settings';
import type { WorkerMessage, IndexerProgressPayload, LiteRTEmbedRequestPayload } from './types';

const ctx: Worker = self as any;

// BroadcastChannel lets the indexer trigger embedding without a direct worker reference.
// litert.worker.ts listens on the same channel name.
const embedChannel = new BroadcastChannel('ferret-litert-embed');

ctx.onmessage = async (event: MessageEvent<{ handle: FileSystemDirectoryHandle, directoryId: string }>) => {
  const { handle, directoryId } = event.data;

  if (!handle || !directoryId) {
    ctx.postMessage({ type: 'INDEX_ERROR', payload: 'Invalid payload: handle and directoryId are required.' });
    return;
  }

  try {
    ctx.postMessage({ type: 'INDEX_START' } as WorkerMessage<null>);
    
    let processed = 0;
    
    for await (const { metadata, file } of traverseDirectory(handle, directoryId)) {
      const existingFile = await getFile(metadata.id);
      const requiresUpdate = !existingFile || existingFile.lastModified !== metadata.lastModified;

      if (requiresUpdate) {
        const content = await file.text();
        
        await saveFile({
          ...metadata,
          content,
          indexedAt: Date.now(),
        });

        // Dispatch embedding request for this file via BroadcastChannel.
        // We send a representative chunk: first maxChunkSizeChars characters
        // (same safe limit used by the WebLLM worker).
        const textChunk = content.slice(0, APP_CONFIG.ai.maxChunkSizeChars);
        const embedPayload: LiteRTEmbedRequestPayload = {
          fileId: metadata.id,
          text: textChunk,
        };
        embedChannel.postMessage({
          type: 'LITERT_EMBED_REQUEST',
          payload: embedPayload,
        } as WorkerMessage<LiteRTEmbedRequestPayload>);
      }
      
      processed++;
      
      if (processed % 10 === 0) {
        ctx.postMessage({
          type: 'INDEX_PROGRESS',
          payload: { processed, total: 0, currentFile: metadata.name },
        } as WorkerMessage<IndexerProgressPayload>);
      }
    }

    ctx.postMessage({
      type: 'INDEX_COMPLETE',
      payload: { processed, total: processed, currentFile: '' },
    } as WorkerMessage<IndexerProgressPayload>);

  } catch (error: any) {
    let errMsg = error.message || 'An unknown error occurred during indexing.';
    if (error.name === 'QuotaExceededError' || errMsg.toLowerCase().includes('quota')) {
      errMsg = 'Storage Quota Exceeded: Your browser lacks space to index more files. Use System Controls to wipe data and try a smaller folder.';
    }

    ctx.postMessage({
      type: 'INDEX_ERROR',
      payload: errMsg,
    } as WorkerMessage<string>);
  }
};
