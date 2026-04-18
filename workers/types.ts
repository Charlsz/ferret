/**
 * workers/types.ts
 *
 * Strict typings for messages exchanged with Web Workers.
 * - 'IndexerWorker': Responsible for reading files incrementally.
 * - 'SearchWorker': Performs cross-searches on text.
 */

export type WorkerMessageType = 
  | 'INDEX_START' 
  | 'INDEX_PROGRESS' 
  | 'INDEX_COMPLETE' 
  | 'INDEX_ERROR';

export interface WorkerMessage<T> {
  type: WorkerMessageType;
  payload?: T;
}

export interface IndexerProgressPayload {
  processed: number;
  total: number;
  currentFile: string;
}
