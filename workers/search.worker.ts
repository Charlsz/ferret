/**
 * workers/search.worker.ts
 *
 * Dedicated Web Worker for fast full-text local searching.
 * Loads text chunks from IndexedDB and indexes them in memory using MiniSearch.
 */

import MiniSearch from 'minisearch';
import { getDB } from '../lib/db/index';
import type { WorkerMessage, SearchRequestPayload, SearchResultItem } from './types';

const ctx: Worker = self as any;

// Initialize MiniSearch
// We map over id, name, relativePath, and content for full-text search.
const miniSearch = new MiniSearch({
  fields: ['name', 'relativePath', 'content'], // fields to search
  storeFields: ['name', 'relativePath'], // fields to return with search results
});

let isReady = false;

/**
 * Bootstraps the index from IndexedDB.
 */
async function buildIndex() {
  try {
    const db = await getDB();
    const files = await db.getAll('files');
    
    // Add all files into the in-memory index
    miniSearch.addAll(files.map(f => ({
      id: f.id,
      name: f.name,
      relativePath: f.relativePath,
      content: f.content || '',
    })));

    isReady = true;
    ctx.postMessage({ type: 'SEARCH_READY', payload: true } as WorkerMessage<boolean>);
  } catch (error: any) {
    ctx.postMessage({ type: 'SEARCH_ERROR', payload: error.message } as WorkerMessage<string>);
  }
}

// Start building index as soon as the worker spins up
buildIndex();

ctx.onmessage = (event: MessageEvent<WorkerMessage<SearchRequestPayload>>) => {
  if (event.data.type === 'SEARCH_REQUEST') {
    if (!isReady) {
      ctx.postMessage({ type: 'SEARCH_ERROR', payload: 'Search index is not ready yet.' } as WorkerMessage<string>);
      return;
    }

    const payload = event.data.payload;
    if (!payload?.query) {
      ctx.postMessage({ type: 'SEARCH_RESULTS', payload: [] } as WorkerMessage<SearchResultItem[]>);
      return;
    }

    const rawResults = miniSearch.search(payload.query, {
      prefix: true, // Allow partial matches
      fuzzy: 0.2,   // Allow small typos
    });

    const results: SearchResultItem[] = rawResults.slice(0, payload.limit || 20).map(res => ({
      id: res.id,
      name: res.name,
      relativePath: res.relativePath,
      score: res.score,
      // For a real production app we could extract exact snippets from content here, 
      // but avoiding loading full text per result keeps it fast.
    }));

    ctx.postMessage({ type: 'SEARCH_RESULTS', payload: results } as WorkerMessage<SearchResultItem[]>);
  }
};
