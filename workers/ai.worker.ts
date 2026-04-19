/**
 * workers/ai.worker.ts
 *
 * Dedicated Web Worker for running the local inference engine (WebLLM) on WebGPU.
 * Lazy-loads the model only when an explanation is required, keeping memory footprint low.
 */

import { CreateMLCEngine, InitProgressReport } from '@mlc-ai/web-llm';
import { getFile } from '../lib/db/index';
import { APP_CONFIG } from '../config/settings';
import type { 
  WorkerMessage, 
  AIExplainRequestPayload, 
  AIExplainResponsePayload, 
  AIInitProgressPayload,
  AIModelState
} from './types';

const ctx: Worker = self as any;

let engine: any = null;
let isInitializing = false;

function setModelState(state: AIModelState) {
  ctx.postMessage({ type: 'AI_STATE_CHANGE', payload: state } as WorkerMessage<AIModelState>);
}

async function initEngine() {
  if (engine) return engine;
  if (isInitializing) throw new Error('Engine is currently initializing...');

  // Graceful WebGPU recovery
  // @ts-ignore - navigator.gpu is standard but TS might need dom lib updates
  if (!navigator.gpu) {
    throw new Error('WebGPU is not supported by your browser or is disabled. Ferret requires WebGPU to securely run models locally.');
  }

  isInitializing = true;
  setModelState('DOWNLOADING');

  try {
    const initProgressCallback = (report: InitProgressReport) => {
      // Provide detailed feedback via the progress report.
      // If it's finishing up, we stay in downloading visually until complete
      ctx.postMessage({
        type: 'AI_INIT_PROGRESS',
        payload: { text: report.text, progress: report.progress }
      } as WorkerMessage<AIInitProgressPayload>);
    };

    // Instantiate engine utilizing WebGPU.
    engine = await CreateMLCEngine(APP_CONFIG.ai.defaultModelId, {
      initProgressCallback,
    });

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

ctx.onmessage = async (event: MessageEvent<WorkerMessage<AIExplainRequestPayload>>) => {
  if (event.data.type === 'AI_EXPLAIN_REQUEST') {
    const { fileId, userPrompt } = event.data.payload as AIExplainRequestPayload;

    try {
      // 1. Fetch file directly from local DB
      const fileRecord = await getFile(fileId);
      if (!fileRecord || !fileRecord.content) {
        throw new Error('File not found or has no content to explain.');
      }

      // 2. Initialize engine if not already done (Wait for VRAM load)
      const currentEngine = await initEngine();

      // 3. Security/Performance: Semantic(ish) Chunking
      // Rather than cutting a word or block of code exactly at max chars, 
      // we roll back to the nearest newline to avoid syntax breakage.
      let fileContentChunk = fileRecord.content;
      const isTruncated = fileContentChunk.length > APP_CONFIG.ai.maxChunkSizeChars;
      
      if (isTruncated) {
        const hardCut = fileContentChunk.slice(0, APP_CONFIG.ai.maxChunkSizeChars);
        const lastNewline = hardCut.lastIndexOf('\n');
        fileContentChunk = hardCut.slice(0, lastNewline > 0 ? lastNewline : APP_CONFIG.ai.maxChunkSizeChars);
      }

      // 4. Structured System Prompt
      const systemPrompt = `You are Ferret, an expert local-first coding explainer. 
Analyze the file below. Format your entire response exactly with these headers (use MarkDown headers):
### Purpose
[Brief summary of what this file does in the architecture]
### Key Functions / Classes
[List the main exports/functions and their roles]
### Dependencies
[Key internal/external imports used]
### Risks & Notes
[Any security, performance, or technical debt observations, or 'None' if perfectly clean]

File Name: ${fileRecord.relativePath} (Extension: ${fileRecord.extension})
${isTruncated ? '[Note: File content truncated due to size limits. Base your explanation strictly on the provided top chunk.]' : ''}`;

      const userMessage = userPrompt 
        ? `Additionally, address this user request: "${userPrompt}"\n\nFile Content:\n${fileContentChunk}`
        : `File Content:\n${fileContentChunk}`;

      // 5. Run inference
      setModelState('GENERATING');
      
      const reply = await currentEngine.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.7,
        max_tokens: 500, // keep responses concise
      });

      // 6. Return payload
      setModelState('READY');
      
      const linesCount = fileContentChunk.split('\n').length;
      
      ctx.postMessage({
        type: 'AI_EXPLAIN_RESPONSE',
        payload: {
          text: reply.choices[0]?.message?.content || 'No explanation generated.',
          sourceChunk: {
            startLine: 1,
            endLine: linesCount,
            isTruncated,
          },
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
