/**
 * lib/fs/types.ts
 *
 * Type definitions for the File System access layer.
 * We use the 'FileSystemDirectoryHandle' and 'FileSystemFileHandle' APIs 
 * which are modern web standards.
 */

export interface ConnectedDirectory {
  id: string; // Hash or unique identifier of the directory
  name: string;
  handle: FileSystemDirectoryHandle;
  connectedAt: number; // Timestamp
}

export interface FileMetadata {
  id: string; // Unique hash based on relative path and content or name
  directoryId: string; // To which connected directory it belongs
  relativePath: string;
  name: string;
  extension: string;
  size: number;
  lastModified: number;
}
