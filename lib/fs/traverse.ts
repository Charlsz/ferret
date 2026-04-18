/**
 * lib/fs/traverse.ts
 *
 * Utilities for recursively scanning a directory handle, applying 
 * strict security and performance filters based on central configs.
 */

import { APP_CONFIG } from '../../config/settings';
import type { FileMetadata } from './types';

/**
 * Extracts the extension from a filename.
 */
function getExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1 || lastDot === 0) return '';
  return filename.substring(lastDot).toLowerCase();
}

/**
 * Async generator that recursively yields allowed files from a directory handle.
 * Using an async generator prevents loading massive folder structures into memory all at once.
 * 
 * @param dirHandle The root directory handle to scan
 * @param directoryId The ID of the connected directory
 * @param relativePath Internal use for recursion Path tracking
 */
export async function* traverseDirectory(
  dirHandle: FileSystemDirectoryHandle,
  directoryId: string,
  relativePath: string = ''
): AsyncGenerator<{ metadata: FileMetadata; file: File }> {
  
  // @ts-ignore - TS DOM types don't fully define async iterators for DirectoryHandles natively yet
  for await (const [name, handle] of dirHandle.entries()) {
    const currentPath = relativePath ? `${relativePath}/${name}` : name;

    if (handle.kind === 'directory') {
      // Security/Performance: Exclude hidden folders and heavy dependencies
      if (name.startsWith('.') || name === 'node_modules') continue;

      yield* traverseDirectory(handle as FileSystemDirectoryHandle, directoryId, currentPath);
    } 
    else if (handle.kind === 'file') {
      // Exclude hidden files
      if (name.startsWith('.')) continue;

      const extension = getExtension(name);
      
      // Filter 1: Whitelist check
      if (!APP_CONFIG.fs.allowedExtensions.has(extension)) continue;

      const fileHandle = handle as FileSystemFileHandle;
      const file = await fileHandle.getFile();

      // Filter 2: Max size check
      if (file.size > APP_CONFIG.fs.maxFileSizeBytes) continue;

      const metadata: FileMetadata = {
        id: `${directoryId}:${currentPath}`, // Unique composite ID
        directoryId,
        relativePath: currentPath,
        name,
        extension,
        size: file.size,
        lastModified: file.lastModified, // For incremental indexing checks
      };

      yield { metadata, file };
    }
  }
}
