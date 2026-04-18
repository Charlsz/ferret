import { DBSchema } from 'idb';
import type { ConnectedDirectory, FileMetadata } from '../fs/types';

/**
 * lib/db/types.ts
 *
 * Typed schema for IndexedDB using 'idb'.
 */
export interface FerretDBSchema extends DBSchema {
  // Stores the handles of the connected directories by the user
  dirs: {
    key: string; // directoryId
    value: ConnectedDirectory;
  };

  // Stores metadata and content (optional/truncated) of indexed files
  files: {
    key: string; // fileId (e.g., full path or hash)
    value: FileMetadata & { 
      content?: string; // Scanned content for searches
      indexedAt: number;
    };
    indexes: {
      'by-directory': string; // To search for files in a specific directory
      'by-extension': string; // To filter files by extension
      'by-last-modified': number;
    };
  };
}
