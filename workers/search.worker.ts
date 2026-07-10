/**
 * workers/search.worker.ts
 *
 * Dedicated Web Worker for fast full-text local searching.
 * Now supports hybrid search: BM25 keyword search (MiniSearch) fused
 * with vector cosine similarity against LiteRT-generated embeddings.
 *
 * Search flow:
 *   1. Run MiniSearch BM25 on query → keyword results with scores.
 *   2. Send query to litert.worker.ts via BroadcastChannel to get a query vector.
 *   3. Compute cosine similarity of the query vector against all stored embeddings.
 *   4. Merge and re-rank: combined_score = 0.5 * bm25_norm + 0.5 * cosine.
 *   5. Return top-N results.
 *
 * If no embeddings are available yet (e.g. LiteRT still initialising),
 * the worker gracefully falls back to BM25-only results.
 */

import MiniSearch from 'minisearch';
import { getDB } from '../lib/db/index';
import { APP_CONFIG } from '../config/settings';
import type {
  WorkerMessage,
  SearchRequestPayload,
  SearchResultItem,
  LiteRTEmbedRequestPayload,
  LiteRTEmbedResponsePayload,
} from './types';

const ctx: Worker = self as any;

const miniSearch = new MiniSearch({
  fields: ['name', 'relativePath', 'content'],
  storeFields: ['name', 'relativePath'],
});

let isReady = false;

// In-memory embedding store: fileId → Float32Array
// Populated from IndexedDB on startup and updated live via BroadcastChannel.
const embeddingStore = new Map<string, Float32Array>();

// BroadcastChannel to request a query embedding from litert.worker.ts
const embedRequestChannel = new BroadcastChannel('ferret-litert-embed');
const embedResponseChannel = new BroadcastChannel('ferret-litert-embed-response');

// Pending embedding requests keyed by a temporary requestId
const pendingEmbedRequests = new Map<string, (vector: Float32Array) => void>();

embedResponseChannel.onmessage = (event: MessageEvent<WorkerMessage<LiteRTEmbedResponsePayload>>) => {
  if (event.data.type === 'LITERT_EMBED_RESPONSE') {
    const { fileId, vector } = event.data.payload!;
    // Update in-memory store live as embeddings arrive from indexer runs
    embeddingStore.set(fileId, new Float32Array(vector));
    // Resolve any pending query embedding promise
    const resolve = pendingEmbedRequests.get(fileId);
    if (resolve) {
      resolve(new Float32Array(vector));
      pendingEmbedRequests.delete(fileId);
    }
  }
};

function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0, normA = 0, normB = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-8);
}

/**
 * Requests a query embedding from litert.worker.ts and waits for the response.
 * Times out after 2s and returns null if LiteRT is not ready.
 */
function requestQueryEmbedding(query: string): Promise<Float32Array | null> {
  return new Promise((resolve) => {
    const tempId = `query-${Date.now()}`;
    const timeout = setTimeout(() => {
      pendingEmbedRequests.delete(tempId);
      resolve(null);
    }, 2000);

    pendingEmbedRequests.set(tempId, (vector) => {
      clearTimeout(timeout);
      resolve(vector);
    });

    embedRequestChannel.postMessage({
      type: 'LITERT_EMBED_REQUEST',
      payload: { fileId: tempId, text: query } as LiteRTEmbedRequestPayload,
    } as WorkerMessage<LiteRTEmbedRequestPayload>);
  });
}

async function buildIndex() {
  try {
    const db = await getDB();
    const files = await db.getAll('files');
    
    miniSearch.addAll(files.map(f => ({
      id: f.id,
      name: f.name,
      relativePath: f.relativePath,
      content: f.content || '',
    })));

    // Pre-load all available embeddings from IndexedDB into memory
    for (const f of files) {
      if (f.embedding && f.embedding.length > 0) {
        embeddingStore.set(f.id, new Float32Array(f.embedding));
      }
    }

    isReady = true;
    ctx.postMessage({ type: 'SEARCH_READY', payload: true } as WorkerMessage<boolean>);
  } catch (error: any) {
    ctx.postMessage({ type: 'SEARCH_ERROR', payload: error.message } as WorkerMessage<string>);
  }
}

buildIndex();

ctx.onmessage = async (event: MessageEvent<WorkerMessage<SearchRequestPayload>>) => {
  if (event.data.type !== 'SEARCH_REQUEST') return;

  if (!isReady) {
    ctx.postMessage({ type: 'SEARCH_ERROR', payload: 'Search index is not ready yet.' } as WorkerMessage<string>);
    return;
  }

  const payload = event.data.payload;
  if (!payload?.query) {
    ctx.postMessage({ type: 'SEARCH_RESULTS', payload: [] } as WorkerMessage<SearchResultItem[]>);
    return;
  }

  const limit = payload.limit || 20;

  // 1. BM25 keyword search
  const rawBM25 = miniSearch.search(payload.query, { prefix: true, fuzzy: 0.2 });
  const maxBM25Score = rawBM25.length > 0 ? Math.max(...rawBM25.map(r => r.score)) : 1;
  const bm25Map = new Map(rawBM25.map(r => [r.id as string, r.score / maxBM25Score]));

  // 2. Semantic vector search (best-effort — skipped if LiteRT not ready)
  const queryVector = embeddingStore.size > 0 ? await requestQueryEmbedding(payload.query) : null;
  const threshold = APP_CONFIG.litert.semanticScoreThreshold;

  const semanticMap = new Map<string, number>();
  if (queryVector) {
    for (const [fileId, fileVector] of embeddingStore) {
      const sim = cosineSimilarity(queryVector, fileVector);
      if (sim >= threshold) {
        semanticMap.set(fileId, sim);
      }
    }
  }

  // 3. Merge candidate sets
  const candidateIds = new Set<string>([
    ...bm25Map.keys(),
    ...semanticMap.keys(),
  ]);

  // 4. Compute combined score and retrieve stored fields from MiniSearch
  const bm25ResultMap = new Map(rawBM25.map(r => [r.id as string, r]));

  const merged: SearchResultItem[] = [];
  for (const id of candidateIds) {
    const bm25Score = bm25Map.get(id) ?? 0;
    const semanticScore = semanticMap.get(id) ?? 0;
    const combinedScore = 0.5 * bm25Score + 0.5 * semanticScore;

    const meta = bm25ResultMap.get(id);
    if (!meta && !semanticMap.has(id)) continue;

    merged.push({
      id,
      name: meta?.name ?? id,
      relativePath: meta?.relativePath ?? id,
      score: combinedScore,
    });
  }

  merged.sort((a, b) => b.score - a.score);

  ctx.postMessage({
    type: 'SEARCH_RESULTS',
    payload: merged.slice(0, limit),
  } as WorkerMessage<SearchResultItem[]>);
};
