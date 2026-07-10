/**
 * scripts/copy-wasm.mjs
 *
 * Copies LiteRT.js WASM runtime files from node_modules into public/wasm/
 * so Next.js can serve them as static assets. Runs automatically via postinstall.
 */

import { cpSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const src = join(root, 'node_modules', '@litertjs', 'core', 'wasm');
const dest = join(root, 'public', 'wasm');

if (existsSync(src)) {
  mkdirSync(dest, { recursive: true });
  cpSync(src, dest, { recursive: true });
  console.log('[ferret] LiteRT WASM assets copied to public/wasm/');
} else {
  console.warn('[ferret] @litertjs/core wasm directory not found — skipping copy. Run `bun install` after the package is available.');
}
