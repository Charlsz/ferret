'use client';

import { useState, useEffect } from 'react';
import { getFile } from '@/lib/db/index';

/**
 * hooks/useFileViewer.ts
 *
 * Lightweight IDB retrieval hook for rendering the raw code snippet in the UI.
 */
export function useFileViewer(fileId: string | undefined) {
  const [content, setContent] = useState<string | null>(null);
  
  useEffect(() => {
    if (!fileId) {
       setContent(null);
       return;
    }
    
    // Asynchronously grab the content from IndexedDB without hitting the file-system again
    getFile(fileId).then(record => {
       if (record && record.content) {
         setContent(record.content);
       } else {
         setContent('Content unavailable or not indexed.');
       }
    }).catch(err => {
       console.error('IDB Fetch Error', err);
       setContent('Error loading content cache.');
    });
  }, [fileId]);

  return { content };
}
