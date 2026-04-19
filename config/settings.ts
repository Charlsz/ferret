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
    version: 1,
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
  }
} as const;
