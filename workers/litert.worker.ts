/// <reference types="@webgpu/types" />
/**
 * workers/litert.worker.ts
 *
 * Dedicated Web Worker for on-device inference via LiteRT.js v2.x.
 *
 * Real @litertjs/core v2.5.2 API used here:
 *   loadLiteRt(wasmPath)                         — boot WASM runtime
 *   isWebGPUSupported()                          — exported helper
 *   setWebGpuDevice(device)                      — register GPUDevice before webgpu compile
 *   loadAndCompile(url, { accelerator })         — compile .tflite model
 *   new Tensor(typedArray, shape)                — wrap input data
 *   model.run(Tensor | Tensor[])                 — run inference, returns Tensor[]
 *   tensor.data()                                — Promise<TypedArray> read-back
 *   tensor.delete() / model.delete()             — free C++ memory
 */

import {
  loadLiteRt,
  loadAndCompile,
  isWebGPUSupported,
  setWebGpuDevice,
  Tensor,
} from '@litertjs/core';
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

    // Attempt WebGPU acceleration; register the device before loadAndCompile.
    // Falls back to wasm if WebGPU is unavailable or device request fails.
    const hasWebGPU = isWebGPUSupported();
    if (hasWebGPU) {
      try {
        const adapter = await navigator.gpu.requestAdapter();
        if (adapter) {
          const device = await adapter.requestDevice();
          setWebGpuDevice(device);
          currentAccelerator = 'webgpu';
        }
      } catch {
        currentAccelerator = 'wasm';
      }
    }

    const accelerator = currentAccelerator;

    const embedUrl = await getCachedModelBlobUrl(
      APP_CONFIG.litert.embedModelUrl,
      APP_CONFIG.litert.embedModelCacheKey,
    );
    const classifyUrl = await getCachedModelBlobUrl(
      APP_CONFIG.litert.classifyModelUrl,
      APP_CONFIG.litert.classifyModelCacheKey,
    );

    // If WebGPU compile fails, retry with wasm.
    try {
      embedModel = await loadAndCompile(embedUrl, { accelerator });
      classifyModel = await loadAndCompile(classifyUrl, { accelerator });
    } catch (gpuErr) {
      if (accelerator !== 'wasm') {
        console.warn('[LiteRT] WebGPU compile failed, retrying with wasm:', gpuErr);
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
 * Tokenise text into a fixed-length int32 sequence via djb2 hash.
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
      ctx.postMessage({
        type: 'LITERT_EMBED_ERROR',
        payload: `Init failed: ${err.message}`,
      } as WorkerMessage<string>);
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
      // model.run() requires Tensor instances, not raw TypedArrays
      const inputTensor = new Tensor(tokenIds, [1, seqLen]);
      const results = await embedModel.run(inputTensor) as Tensor[];
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
      ctx.postMessage({
        type: 'LITERT_EMBED_ERROR',
        payload: err.message,
      } as WorkerMessage<string>);
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
      const results = await classifyModel.run(inputTensor) as Tensor[];
      inputTensor.delete();

      const scores = await results[0].data() as Float32Array;
      results[0].delete();

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
      ctx.postMessage({
        type: 'LITERT_CLASSIFY_ERROR',
        payload: err.message,
      } as WorkerMessage<string>);
    }
    return;
  }
};
