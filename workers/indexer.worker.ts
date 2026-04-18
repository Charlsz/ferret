/**
 * workers/indexer.worker.ts
 *
 * Dedicated Web Worker for asynchronous file traversal and indexing.
 * Does not block the main UI thread during heavy text reading operations.
 */

import { traverseDirectory } from '../lib/fs/traverse';
import { getFile, saveFile } from '../lib/db/index';
import type { WorkerMessage, IndexerProgressPayload } from './types';

// Web Worker global scope interface
const ctx: Worker = self as any;

ctx.onmessage = async (event: MessageEvent<{ handle: FileSystemDirectoryHandle, directoryId: string }>) => {
  const { handle, directoryId } = event.data;

  if (!handle || !directoryId) {
    ctx.postMessage({ type: 'INDEX_ERROR', payload: 'Invalid payload: handle and directoryId are required.' });
    return;
  }

  try {
    ctx.postMessage({ type: 'INDEX_START' } as WorkerMessage<null>);
    
    let processed = 0;
    
    // We don't know total file count in advance when using async generators
    // So we just send processed count back to the UI.
    
    for await (const { metadata, file } of traverseDirectory(handle, directoryId)) {
      // Incremental indexing: Check if file changed since last indexed
      const existingFile = await getFile(metadata.id);
      
      const requiresUpdate = !existingFile || existingFile.lastModified !== metadata.lastModified;

      if (requiresUpdate) {
        // Read file content as text
        const content = await file.text();
        
        await saveFile({
          ...metadata,
          content,
          indexedAt: Date.now(),
        });
      }
      
      processed++;
      
      // Throttle postMessage if there are too many files (simple optimization)
      // For now, post every single update or batch them. Let's post every 10 or specifically to keep UI responsive.
      if (processed % 10 === 0) {
        ctx.postMessage({
          type: 'INDEX_PROGRESS',
          payload: { processed, total: 0, currentFile: metadata.name }, // `total` is unknown until finished
        } as WorkerMessage<IndexerProgressPayload>);
      }
    }

    // Final update
    ctx.postMessage({
      type: 'INDEX_COMPLETE',
      payload: { processed, total: processed, currentFile: '' },
    } as WorkerMessage<IndexerProgressPayload>);

  } catch (error: any) {
    ctx.postMessage({
      type: 'INDEX_ERROR',
      payload: error.message || 'An unknown error occurred during indexing.',
    } as WorkerMessage<string>);
  }
};
