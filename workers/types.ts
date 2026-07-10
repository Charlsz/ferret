/**
 * workers/types.ts
 *
 * Strict typings for messages exchanged with Web Workers.
 * - 'IndexerWorker': Responsible for reading files incrementally.
 * - 'SearchWorker': Performs cross-searches on text.
 * - 'LiteRTWorker': Runs on-device inference via LiteRT.js (.tflite models).
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
  | 'AI_CHECK_CACHE_RESPONSE'
  // LiteRT worker messages
  | 'LITERT_INIT'
  | 'LITERT_READY'
  | 'LITERT_STATE_CHANGE'
  | 'LITERT_EMBED_REQUEST'
  | 'LITERT_EMBED_RESPONSE'
  | 'LITERT_EMBED_ERROR'
  | 'LITERT_CLASSIFY_REQUEST'
  | 'LITERT_CLASSIFY_RESPONSE'
  | 'LITERT_CLASSIFY_ERROR';

export type AIModelState = 'NOT_LOADED' | 'DOWNLOADING' | 'READY' | 'GENERATING' | 'ERROR';

/** State machine for the LiteRT runtime inside its worker. */
export type LiteRTState = 'NOT_LOADED' | 'LOADING' | 'READY' | 'RUNNING' | 'ERROR';

/** Indicates whether LiteRT is accelerated by WebGPU or falling back to WASM CPU. */
export type LiteRTAccelerator = 'webgpu' | 'wasm';

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

// --- LiteRT Payloads ---

export interface LiteRTStatePayload {
  state: LiteRTState;
  accelerator?: LiteRTAccelerator;
}

/**
 * Request a floating-point embedding vector for a text chunk.
 * fileId is used to persist the vector back to IndexedDB after generation.
 */
export interface LiteRTEmbedRequestPayload {
  fileId: string;
  text: string;
}

/** The resulting embedding vector for a given fileId. */
export interface LiteRTEmbedResponsePayload {
  fileId: string;
  vector: number[];
}

/**
 * Request classification of a file chunk into a known category.
 * Used by ai.worker.ts to pick the best system prompt before WebLLM inference.
 */
export interface LiteRTClassifyRequestPayload {
  fileId: string;
  text: string;
}

/** Classification result: one of the categories the .tflite model was trained for. */
export interface LiteRTClassifyResponsePayload {
  fileId: string;
  /** e.g. 'code' | 'prose' | 'config' | 'data' */
  category: string;
  confidence: number;
}
