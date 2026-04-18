import { openDB, IDBPDatabase } from 'idb';
import { APP_CONFIG } from '../../config/settings';
import type { FerretDBSchema } from './types';
import type { ConnectedDirectory, FileMetadata } from '../fs/types';

/**
 * lib/db/index.ts
 *
 * IndexedDB wrapper using 'idb' for type safety and promises.
 * Handles the initialization, migrations, and basic CRUD operations.
 */

let dbPromise: Promise<IDBPDatabase<FerretDBSchema>> | null = null;

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<FerretDBSchema>(APP_CONFIG.db.name, APP_CONFIG.db.version, {
      upgrade(db) {
        // Create store for directory handles
        if (!db.objectStoreNames.contains('dirs')) {
          db.createObjectStore('dirs', { keyPath: 'id' });
        }

        // Create store for file metadata and content
        if (!db.objectStoreNames.contains('files')) {
          const fileStore = db.createObjectStore('files', { keyPath: 'id' });
          // Indexes for fast querying
          fileStore.createIndex('by-directory', 'directoryId');
          fileStore.createIndex('by-extension', 'extension');
          fileStore.createIndex('by-last-modified', 'lastModified');
        }
      },
    });
  }
  return dbPromise;
}

// --- Directory Operations ---

export async function saveDirectory(dir: ConnectedDirectory): Promise<void> {
  const db = await getDB();
  await db.put('dirs', dir);
}

export async function getDirectories(): Promise<ConnectedDirectory[]> {
  const db = await getDB();
  return db.getAll('dirs');
}

export async function removeDirectory(id: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['dirs', 'files'], 'readwrite');
  
  // Remove the directory entry
  await tx.objectStore('dirs').delete(id);
  
  // Remove all files associated with this directory
  const fileStore = tx.objectStore('files');
  const dirIndex = fileStore.index('by-directory');
  let cursor = await dirIndex.openCursor(id);
  
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
  
  await tx.done;
}

// --- File Operations ---

type FileRecord = FileMetadata & { content?: string; indexedAt: number };

export async function saveFile(file: FileRecord): Promise<void> {
  const db = await getDB();
  await db.put('files', file);
}

export async function getFile(id: string): Promise<FileRecord | undefined> {
  const db = await getDB();
  return db.get('files', id);
}
