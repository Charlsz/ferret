import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js 16 uses Turbopack by default.
  // Turbopack handles asyncWebAssembly natively; no extra config needed.
  // An explicit (even empty) turbopack key silences the webpack/turbopack mismatch error.
  turbopack: {},

  // Ensure WASM MIME type is served correctly by Next.js static server
  async headers() {
    return [
      {
        source: '/wasm/:file*',
        headers: [
          { key: 'Content-Type', value: 'application/wasm' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
