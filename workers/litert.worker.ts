/// <reference types="@webgpu/types" />
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
 *
 * Uses the real @litertjs/core v2.x API:
 *   - loadLiteRt(wasmPath)          — load WASM runtime
 *   - loadAndCompile(url, options)  — compile a .tflite model
 *   - model.run([TypedArray, ...])  — run inference
 *   - model.getInputDetails()       — inspect input shapes
 * WebGPU device selection is handled internally by loadAndCompile; no manual
 * setWebGpuDevice() call is needed or available in v2.x.
 */

import { loadLiteRt, loadAndCompile } from '@litertjs/core';
import { getCachedModelBlobUrl } from '../lib/litert/modelLoader';
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
let liteRtLoaded = false;
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
    if (!liteRtLoaded) {
      await loadLiteRt(APP_CONFIG.litert.wasmPath);
      liteRtLoaded = true;
    }

    // Determine the best available accelerator.
    // loadAndCompile handles WebGPU device setup internally in v2.x;
    // we only need to decide which accelerator string to pass.
    const hasWebGPU =
      typeof navigator !== 'undefined' &&
      'gpu' in navigator &&
      typeof (navigator as any).gpu?.requestAdapter === 'function';

    currentAccelerator = hasWebGPU ? 'webgpu' : 'wasm';

    const accelerator = currentAccelerator;

    const embedUrl = await getCachedModelBlobUrl(
      APP_CONFIG.litert.embedModelUrl,
      APP_CONFIG.litert.embedModelCacheKey,
    );
    const classifyUrl = await getCachedModelBlobUrl(
      APP_CONFIG.litert.classifyModelUrl,
      APP_CONFIG.litert.classifyModelCacheKey,
    );

    // If WebGPU fails (unsupported op, shape mismatch, etc.) fall back to wasm.
    try {
      embedModel = await loadAndCompile(embedUrl, { accelerator });
      classifyModel = await loadAndCompile(classifyUrl, { accelerator });
    } catch (gpuErr) {
      if (accelerator !== 'wasm') {
        console.warn('[LiteRT] WebGPU load failed, retrying with wasm:', gpuErr);
        currentAccelerator = 'wasm';
        embedModel = await loadAndCompile(embedUrl, { accelerator: 'wasm' });
        classifyModel = await loadAndCompile(classifyUrl, { accelerator: 'wasm' });
      } else {
        throw gpuErr;
      }
    }

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
 * Tokenise a string into a fixed-length int32 sequence.
 * Simple djb2-hash tokeniser — adequate for semantic similarity at this scale.
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
    let hash = 5381;
    for (let c = 0; c < tokens[i].length; c++) {
      hash = ((hash << 5) + hash) + tokens[i].charCodeAt(c);
    }
    ids[i] = Math.abs(hash % 9999) + 1;
  }
  return ids;
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

      // v2.x API: model.run accepts an array of TypedArrays matching input tensors
      const results = await embedModel.run([tokenIds]);
      const rawData: Float32Array = results[0] instanceof Float32Array
        ? results[0]
        : new Float32Array(results[0]);

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

      const results = await classifyModel.run([tokenIds]);
      const scores: Float32Array = results[0] instanceof Float32Array
        ? results[0]
        : new Float32Array(results[0]);

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
