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
  | 'INDEX_ERROR'
  | 'SEARCH_READY'
  | 'SEARCH_REQUEST'
  | 'SEARCH_RESULTS'
  | 'SEARCH_ERROR'
  | 'AI_INIT_PROGRESS'
  | 'AI_INIT_COMPLETE'
  | 'AI_STATE_CHANGE'
  | 'AI_EXPLAIN_REQUEST'
  | 'AI_EXPLAIN_RESPONSE'
  | 'AI_EXPLAIN_ERROR'
  | 'AI_CHECK_CACHE'
  | 'AI_CHECK_CACHE_RESPONSE';

export type AIModelState = 'NOT_LOADED' | 'DOWNLOADING' | 'READY' | 'GENERATING' | 'ERROR';

export interface WorkerMessage<T> {
  type: WorkerMessageType;
  payload?: T;
}

export interface IndexerProgressPayload {
  processed: number;
  total: number;
  currentFile: string;
}

export interface SearchRequestPayload {
  query: string;
  limit?: number;
}

export interface SearchResultItem {
  id: string;
  name: string;
  relativePath: string;
  matchSnippet?: string;
  score: number;
}

export interface AIInitProgressPayload {
  text: string;
  progress: number;
}

export interface AIExplainRequestPayload {
  fileId: string;
  userPrompt?: string;
}

export interface AIExplainResponsePayload {
  text: string;
  sourceChunk?: {
    startLine: number;
    endLine: number;
    isTruncated: boolean;
  };
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

