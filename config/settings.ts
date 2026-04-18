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
    // Default model ID for WebLLM. 
    // We use a lightweight and optimized one for the browser (WebGPU).
    defaultModelId: 'Llama-3-8B-Instruct-q4f32_1-MLC',
    
    // Safe character limit to send in a single prompt (chunking).
    // Assuming ~4 characters per token, 12000 chars are ~3000 tokens.
    maxChunkSizeChars: 12000,
  }
} as const;
