/**
 * workers/litert.worker.ts
 *
 * Dedicated Web Worker for on-device inference via LiteRT.js.
 * Handles two responsibilities:
 *   1. Text embedding: produces float32 vectors for semantic search.
 *   2. File classification: categorises file content into code/prose/config/data.
 *
 * Both tasks run on WebGPU when available, falling back to WASM/CPU automatically.
 * The worker is lazy-initialised on first request to keep startup cost near zero.
 */

import { loadLiteRt, loadAndCompile, Tensor } from '@litertjs/core';
import { APP_CONFIG } from '../config/settings';
import type {
  WorkerMessage,
  LiteRTStatePayload,
  LiteRTEmbedRequestPayload,
  LiteRTEmbedResponsePayload,
  LiteRTClassifyRequestPayload,
  LiteRTClassifyResponsePayload,
  LiteRTState,
  LiteRTAccelerator,
} from './types';

const ctx: Worker = self as any;

let embedModel: any = null;
let classifyModel: any = null;
let isInitializing = false;
let currentAccelerator: LiteRTAccelerator = 'wasm';

function postState(state: LiteRTState) {
  ctx.postMessage({
    type: 'LITERT_STATE_CHANGE',
    payload: { state, accelerator: currentAccelerator } as LiteRTStatePayload,
  } as WorkerMessage<LiteRTStatePayload>);
}

async function initLiteRT(): Promise<void> {
  if (embedModel && classifyModel) return;
  if (isInitializing) throw new Error('LiteRT is already initialising.');

  isInitializing = true;
  postState('LOADING');

  try {
    // Initialise the WASM runtime (served from /wasm/ via Next.js static assets)
    await loadLiteRt(APP_CONFIG.litert.wasmPath);

    // Detect WebGPU availability
    // @ts-ignore — navigator.gpu is standard but may need updated TS DOM lib
    const hasWebGPU = !!navigator.gpu;
    const accelerator = hasWebGPU ? 'webgpu' : 'wasm';
    currentAccelerator = accelerator;

    // Load the embedding model (.tflite) — Universal Sentence Encoder Lite
    embedModel = await loadAndCompile(APP_CONFIG.litert.embedModelUrl, { accelerator });

    // Load the classification model (.tflite) — MobileBERT-based text classifier
    classifyModel = await loadAndCompile(APP_CONFIG.litert.classifyModelUrl, { accelerator });

    isInitializing = false;
    postState('READY');
    ctx.postMessage({ type: 'LITERT_READY', payload: true } as WorkerMessage<boolean>);
  } catch (err: any) {
    isInitializing = false;
    postState('ERROR');
    throw err;
  }
}

/**
 * Tokenise a string into a fixed-length int32 sequence for USE-Lite.
 * USE-Lite input: int32[1 x 1 x sequenceLength] token IDs.
 * We use a minimal whitespace tokeniser — adequate for semantic similarity at this scale.
 */
function tokenize(text: string, maxLen: number): Int32Array {
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, maxLen);

  const ids = new Int32Array(maxLen);
  for (let i = 0; i < tokens.length; i++) {
    // Simple djb2-style hash into vocabulary range [1, 10000]
    let hash = 5381;
    for (let c = 0; c < tokens[i].length; c++) {
      hash = ((hash << 5) + hash) + tokens[i].charCodeAt(c);
    }
    ids[i] = Math.abs(hash % 9999) + 1;
  }
  return ids;
}

function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-8);
}

ctx.onmessage = async (event: MessageEvent<WorkerMessage<any>>) => {
  const { type, payload } = event.data;

  if (type === 'LITERT_INIT') {
    try {
      await initLiteRT();
    } catch (err: any) {
      ctx.postMessage({ type: 'LITERT_EMBED_ERROR', payload: `Init failed: ${err.message}` } as WorkerMessage<string>);
    }
    return;
  }

  if (type === 'LITERT_EMBED_REQUEST') {
    const { fileId, text } = payload as LiteRTEmbedRequestPayload;
    try {
      await initLiteRT();
      postState('RUNNING');

      const seqLen = APP_CONFIG.litert.embeddingSequenceLength;
      const tokenIds = tokenize(text, seqLen);
      const inputTensor = new Tensor(tokenIds, [1, seqLen]);

      const results = await embedModel.run(inputTensor);
      inputTensor.delete();

      const rawData = await results[0].data() as Float32Array;
      results[0].delete();

      postState('READY');
      ctx.postMessage({
        type: 'LITERT_EMBED_RESPONSE',
        payload: { fileId, vector: Array.from(rawData) } as LiteRTEmbedResponsePayload,
      } as WorkerMessage<LiteRTEmbedResponsePayload>);
    } catch (err: any) {
      postState('ERROR');
      ctx.postMessage({ type: 'LITERT_EMBED_ERROR', payload: err.message } as WorkerMessage<string>);
    }
    return;
  }

  if (type === 'LITERT_CLASSIFY_REQUEST') {
    const { fileId, text } = payload as LiteRTClassifyRequestPayload;
    try {
      await initLiteRT();
      postState('RUNNING');

      const seqLen = APP_CONFIG.litert.classifySequenceLength;
      const tokenIds = tokenize(text, seqLen);
      const inputTensor = new Tensor(tokenIds, [1, seqLen]);

      const results = await classifyModel.run(inputTensor);
      inputTensor.delete();

      const scores = await results[0].data() as Float32Array;
      results[0].delete();

      // Map output index to human-readable category
      const categories = APP_CONFIG.litert.classifyLabels;
      let maxIdx = 0;
      for (let i = 1; i < scores.length; i++) {
        if (scores[i] > scores[maxIdx]) maxIdx = i;
      }

      postState('READY');
      ctx.postMessage({
        type: 'LITERT_CLASSIFY_RESPONSE',
        payload: {
          fileId,
          category: categories[maxIdx] ?? 'unknown',
          confidence: scores[maxIdx],
        } as LiteRTClassifyResponsePayload,
      } as WorkerMessage<LiteRTClassifyResponsePayload>);
    } catch (err: any) {
      postState('ERROR');
      ctx.postMessage({ type: 'LITERT_CLASSIFY_ERROR', payload: err.message } as WorkerMessage<string>);
    }
    return;
  }
};
