/**
 * Ferret - Centralized Configuration
 * 
 * Centralizes business rules, security limits and performance parameters
 * to avoid spreading magic numbers and to facilitate maintenance.
 */

export const APP_CONFIG = {
  // Local Database (IndexedDB)
  db: {
    name: 'ferret_local_db',
    version: 2, // bumped to accommodate the new `embedding` field on file records
    stores: {
      files: 'files',         // Stores file content and metadata
      directories: 'dirs',    // Stores connected directory handles
    }
  },
  
  // File System API Interaction and Security
  fs: {
    // Strict whitelist of text extensions (read-only operation)
    allowedExtensions: new Set([
      '.txt', '.md', '.csv', '.json', 
      '.ts', '.tsx', '.js', '.jsx', 
      '.html', '.css', '.xml', '.yaml', '.yml'
    ]),
    
    // Maximum read limit per file: 5MB
    // Prevents excessive memory consumption in the browser and Web Worker crashes
    maxFileSizeBytes: 5 * 1024 * 1024, 
  },

  // Inference Configuration (WebLLM)
  ai: {
    // We switched to a much faster, coder-specific model (1.5B parameters).
    // It consumes less VRAM, downloads faster by caching via Cache API, 
    // and is fine-tuned for code explanation rather than general chat.
    defaultModelId: 'Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC',
    
    // Safe character limit. 
    maxChunkSizeChars: 12000,
  },

  // LiteRT.js Configuration (on-device .tflite inference)
  litert: {
    // Path where the LiteRT WASM runtime is served from.
    // Files are copied here by scripts/copy-wasm.mjs at postinstall.
    wasmPath: '/wasm',

    // Universal Sentence Encoder Lite — produces 512-dim sentence embeddings.
    // Official Google TFLite model (~25 MB), publicly hosted on TFHub storage.
    embedModelUrl: 'https://storage.googleapis.com/download.tensorflow.org/models/tflite/universal_sentence_encoder_lite/lite-model_universal-sentence-encoder-lite_1_default_1.tflite',
    embedModelCacheKey: 'use-lite-v1',

    // MobileBERT SQuAD — lightweight general-purpose BERT model (~25 MB).
    // Used as a text encoder for 4-class classification (code/prose/config/data)
    // via mean-pooling of the last hidden state, with a simple argmax heuristic.
    // Official Google TFLite model hosted on TFHub storage.
    classifyModelUrl: 'https://storage.googleapis.com/download.tensorflow.org/models/tflite/task_library/text_classification/android/text_classification_v2_1.tflite',
    classifyModelCacheKey: 'text-classify-v2',

    // Labels must match the output head order of classifyModelUrl
    classifyLabels: ['code', 'prose', 'config', 'data'] as const,

    // Token sequence length fed into the embedding model input tensor
    embeddingSequenceLength: 128,

    // Token sequence length fed into the classification model input tensor
    classifySequenceLength: 64,

    // Dimensionality of USE-Lite output vectors (for cosine similarity)
    embeddingDimension: 512,

    // Minimum cosine similarity score to consider a semantic match relevant
    semanticScoreThreshold: 0.45,
  }
} as const;
