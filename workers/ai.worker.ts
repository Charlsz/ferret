/**
 * workers/ai.worker.ts
 *
 * Dedicated Web Worker for running the local inference engine (WebLLM) on WebGPU.
 * Lazy-loads the model only when an explanation is required, keeping memory footprint low.
 *
 * Before invoking WebLLM, the worker now requests a LiteRT file classification
 * via BroadcastChannel. The resulting category (code / prose / config / data)
 * is used to select a tailored system prompt, improving explanation quality
 * without increasing WebLLM token costs.
 */

import { CreateMLCEngine, InitProgressReport, hasModelInCache } from '@mlc-ai/web-llm';
import { getFile } from '../lib/db/index';
import { APP_CONFIG } from '../config/settings';
import type { 
  WorkerMessage, 
  AIExplainRequestPayload, 
  AIExplainResponsePayload, 
  AIInitProgressPayload,
  AIModelState,
  LiteRTClassifyRequestPayload,
  LiteRTClassifyResponsePayload,
} from './types';

const ctx: Worker = self as any;

let engine: any = null;
let isInitializing = false;

// BroadcastChannel to request classification from litert.worker.ts
const classifyRequestChannel = new BroadcastChannel('ferret-litert-classify');
const classifyResponseChannel = new BroadcastChannel('ferret-litert-classify-response');

const pendingClassifyRequests = new Map<string, (result: LiteRTClassifyResponsePayload) => void>();

classifyResponseChannel.onmessage = (event: MessageEvent<WorkerMessage<LiteRTClassifyResponsePayload>>) => {
  if (event.data.type === 'LITERT_CLASSIFY_RESPONSE') {
    const result = event.data.payload!;
    const resolve = pendingClassifyRequests.get(result.fileId);
    if (resolve) {
      resolve(result);
      pendingClassifyRequests.delete(result.fileId);
    }
  }
};

/**
 * Requests a classification from litert.worker.ts.
 * Times out after 1.5s and returns 'code' as a safe default.
 */
function classifyFile(fileId: string, text: string): Promise<string> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      pendingClassifyRequests.delete(fileId);
      resolve('code'); // safe default for Ferret's primary use-case
    }, 1500);

    pendingClassifyRequests.set(fileId, (result) => {
      clearTimeout(timeout);
      resolve(result.category);
    });

    classifyRequestChannel.postMessage({
      type: 'LITERT_CLASSIFY_REQUEST',
      payload: { fileId, text } as LiteRTClassifyRequestPayload,
    } as WorkerMessage<LiteRTClassifyRequestPayload>);
  });
}

/**
 * Returns a category-specific system prompt for better WebLLM output quality.
 */
function buildSystemPrompt(
  category: string,
  filePath: string,
  extension: string,
  isTruncated: boolean
): string {
  const truncationNote = isTruncated
    ? '\n[Note: File content truncated due to size limits. Base your explanation strictly on the provided top chunk.]'
    : '';

  const header = `File: ${filePath} (Extension: ${extension})${truncationNote}\n`;

  switch (category) {
    case 'prose':
      return `You are Ferret, a precise document analyst. Analyze the document below and respond with these MarkDown headers:\n### Summary\n[Core message or argument of this document]\n### Key Points\n[Main points or sections]\n### Audience & Purpose\n[Who this is written for and why]\n### Notes\n[Any notable formatting, tone, or structural observations, or 'None']\n\n${header}`;

    case 'config':
      return `You are Ferret, a DevOps and configuration expert. Analyze the config file below and respond with these MarkDown headers:\n### Purpose\n[What system or tool this configures and its role]\n### Key Settings\n[The most important keys/values and what they control]\n### Dependencies\n[External services, tools, or environment variables referenced]\n### Risks & Notes\n[Security concerns, hardcoded secrets, or misconfigurations, or 'None']\n\n${header}`;

    case 'data':
      return `You are Ferret, a data analyst. Analyze the data file below and respond with these MarkDown headers:\n### Structure\n[Schema, columns, or data shape]\n### Content Overview\n[What this data represents]\n### Data Quality\n[Missing values, anomalies, or format issues observed]\n### Use Cases\n[How this data is likely consumed or queried]\n\n${header}`;

    case 'code':
    default:
      return `You are Ferret, an expert local-first coding explainer. Analyze the file below. Format your entire response exactly with these headers (use MarkDown headers):\n### Purpose\n[Brief summary of what this file does in the architecture]\n### Key Functions / Classes\n[List the main exports/functions and their roles]\n### Dependencies\n[Key internal/external imports used]\n### Risks & Notes\n[Any security, performance, or technical debt observations, or 'None' if perfectly clean]\n\n${header}`;
  }
}

function setModelState(state: AIModelState) {
  ctx.postMessage({ type: 'AI_STATE_CHANGE', payload: state } as WorkerMessage<AIModelState>);
}

async function initEngine() {
  if (engine) return engine;
  if (isInitializing) throw new Error('Engine is currently initializing...');

  // @ts-ignore
  if (!navigator.gpu) {
    throw new Error('WebGPU is not supported by your browser or is disabled. Ferret requires WebGPU to securely run models locally.');
  }

  isInitializing = true;
  setModelState('DOWNLOADING');

  try {
    const initProgressCallback = (report: InitProgressReport) => {
      ctx.postMessage({
        type: 'AI_INIT_PROGRESS',
        payload: { text: report.text, progress: report.progress }
      } as WorkerMessage<AIInitProgressPayload>);
    };

    engine = await CreateMLCEngine(APP_CONFIG.ai.defaultModelId, { initProgressCallback });

    ctx.postMessage({ type: 'AI_INIT_COMPLETE', payload: true } as WorkerMessage<boolean>);
    setModelState('READY');
    return engine;
  } catch (error: any) {
    isInitializing = false;
    setModelState('ERROR');
    ctx.postMessage({ type: 'AI_EXPLAIN_ERROR', payload: `Inference init failed: ${error.message}` } as WorkerMessage<string>);
    throw error;
  }
}

ctx.onmessage = async (event: MessageEvent<WorkerMessage<any>>) => {
  const { type, payload } = event.data;

  if (type === 'AI_CHECK_CACHE') {
    try {
      const isCached = await hasModelInCache(APP_CONFIG.ai.defaultModelId);
      ctx.postMessage({ type: 'AI_CHECK_CACHE_RESPONSE', payload: isCached } as WorkerMessage<boolean>);
    } catch (e) {
      ctx.postMessage({ type: 'AI_CHECK_CACHE_RESPONSE', payload: false } as WorkerMessage<boolean>);
    }
    return;
  }

  if (type === 'AI_EXPLAIN_REQUEST') {
    const { fileId, userPrompt } = payload as AIExplainRequestPayload;

    try {
      // 1. Fetch file from local DB
      const fileRecord = await getFile(fileId);
      if (!fileRecord || !fileRecord.content) {
        throw new Error('File not found or has no content to explain.');
      }

      // 2. Semantic chunking
      let fileContentChunk = fileRecord.content;
      const isTruncated = fileContentChunk.length > APP_CONFIG.ai.maxChunkSizeChars;
      if (isTruncated) {
        const hardCut = fileContentChunk.slice(0, APP_CONFIG.ai.maxChunkSizeChars);
        const lastNewline = hardCut.lastIndexOf('\n');
        fileContentChunk = hardCut.slice(0, lastNewline > 0 ? lastNewline : APP_CONFIG.ai.maxChunkSizeChars);
      }

      // 3. LiteRT classification — pick the best system prompt for this file type
      const classifyChunk = fileContentChunk.slice(0, APP_CONFIG.litert.classifySequenceLength * 6); // ~chars per token
      const category = await classifyFile(fileId, classifyChunk);

      // 4. Build category-aware system prompt
      const systemPrompt = buildSystemPrompt(
        category,
        fileRecord.relativePath,
        fileRecord.extension,
        isTruncated
      );

      // 5. Initialise WebLLM engine (lazy)
      const currentEngine = await initEngine();

      const userMessage = userPrompt
        ? `Additionally, address this user request: "${userPrompt}"\n\nFile Content:\n${fileContentChunk}`
        : `File Content:\n${fileContentChunk}`;

      // 6. Run inference
      setModelState('GENERATING');
      
      const reply = await currentEngine.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.7,
        max_tokens: 500,
      });

      setModelState('READY');
      
      const linesCount = fileContentChunk.split('\n').length;
      
      ctx.postMessage({
        type: 'AI_EXPLAIN_RESPONSE',
        payload: {
          text: reply.choices[0]?.message?.content || 'No explanation generated.',
          sourceChunk: { startLine: 1, endLine: linesCount, isTruncated },
          usage: reply.usage && {
            promptTokens: reply.usage.prompt_tokens,
            completionTokens: reply.usage.completion_tokens,
            totalTokens: reply.usage.total_tokens
          }
        },
      } as WorkerMessage<AIExplainResponsePayload>);

    } catch (error: any) {
      if (error.message !== 'Engine is currently initializing...') {
        setModelState('ERROR');
        ctx.postMessage({
          type: 'AI_EXPLAIN_ERROR',
          payload: error.message || 'An error occurred during inference.',
        } as WorkerMessage<string>);
      }
    }
  }
};
