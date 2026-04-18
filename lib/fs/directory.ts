/**
 * lib/fs/directory.ts
 *
 * Core utilities for requesting directory access using the File System Access API.
 * Ensures read-only access by default to prevent accidental modifications.
 */

import type { ConnectedDirectory } from './types';

/**
 * Prompts the user to select a directory and grant read access.
 */
export async function requestDirectoryAccess(): Promise<ConnectedDirectory | null> {
  try {
    // Only available in secure contexts (HTTPS/localhost)
    if (!('showDirectoryPicker' in window)) {
      throw new Error('File System Access API is not supported in this browser.');
    }

    const handle = await window.showDirectoryPicker({
      mode: 'read',
    });

    return {
      id: crypto.randomUUID(), // Simple unique ID for the session/db
      name: handle.name,
      handle,
      connectedAt: Date.now(),
    };
  } catch (error: any) {
    // AbortError is thrown if the user cancels the picker, perfectly normal
    if (error.name === 'AbortError') {
      return null;
    }
    console.error('Error requesting directory access:', error);
    throw error;
  }
}

/**
 * Verifies if we still have permission to access a handle, asking if necessary.
 * Useful when retrieving stored handles from IndexedDB after page reload.
 */
export async function verifyPermission(
  handle: FileSystemDirectoryHandle,
  withPrompt = true
): Promise<boolean> {
  const options: FileSystemHandlePermissionDescriptor = { mode: 'read' };
  
  if ((await handle.queryPermission(options)) === 'granted') {
    return true;
  }
  
  if (withPrompt) {
    if ((await handle.requestPermission(options)) === 'granted') {
      return true;
    }
  }
  
  return false;
}
