/**
 * lib/litert/modelLoader.ts
 *
 * Utility for fetching and caching .tflite model binaries via the Cache API.
 * Models are downloaded once and served from cache on subsequent sessions,
 * mirroring the approach WebLLM uses for MLC model weights.
 *
 * Usage:
 *   const url = await getCachedModelUrl(APP_CONFIG.litert.embedModelUrl, 'litert-embed-v1');
 *   const model = await loadAndCompile(url, { accelerator: 'webgpu' });
 */

const CACHE_NAME = 'ferret-litert-models-v1';

/**
 * Returns a blob URL pointing to the cached .tflite model.
 * If the model is not yet cached, fetches it, stores it, and returns the blob URL.
 *
 * @param remoteUrl  - The original URL of the .tflite model.
 * @param cacheKey   - A stable string key used to identify this model in the cache.
 */
export async function getCachedModelBlobUrl(
  remoteUrl: string,
  cacheKey: string
): Promise<string> {
  if (!('caches' in self)) {
    // Cache API unavailable (e.g., non-secure context) — fall back to direct URL
    console.warn('[LiteRT] Cache API unavailable. Loading model directly from remote URL.');
    return remoteUrl;
  }

  const cache = await caches.open(CACHE_NAME);
  const cacheRequest = new Request(`/litert-model-cache/${cacheKey}`);
  const cached = await cache.match(cacheRequest);

  if (cached) {
    const blob = await cached.blob();
    return URL.createObjectURL(blob);
  }

  // Not cached — fetch from remote and store
  const response = await fetch(remoteUrl);
  if (!response.ok) {
    throw new Error(`[LiteRT] Failed to fetch model from ${remoteUrl}: ${response.statusText}`);
  }

  // Clone before consuming — cache.put consumes the body
  const responseToCache = response.clone();
  await cache.put(cacheRequest, responseToCache);

  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

/**
 * Checks if a model is already present in the local cache without fetching it.
 */
export async function isModelCached(cacheKey: string): Promise<boolean> {
  if (!('caches' in self)) return false;
  const cache = await caches.open(CACHE_NAME);
  const match = await cache.match(new Request(`/litert-model-cache/${cacheKey}`));
  return match !== undefined;
}

/**
 * Removes a specific model from the cache by its key.
 * Called from purgeAllData() to ensure full cleanup on user request.
 */
export async function evictCachedModel(cacheKey: string): Promise<void> {
  if (!('caches' in self)) return;
  const cache = await caches.open(CACHE_NAME);
  await cache.delete(new Request(`/litert-model-cache/${cacheKey}`));
}

/**
 * Evicts ALL LiteRT model caches. Used by the app-level purge function.
 */
export async function evictAllLiteRTCaches(): Promise<void> {
  if (!('caches' in self)) return;
  await caches.delete(CACHE_NAME);
}
