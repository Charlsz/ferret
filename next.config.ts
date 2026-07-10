import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack(config, { isServer }) {
    // Allow importing .wasm files as assets
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };

    // Prevent Next.js from trying to bundle WASM files meant for the browser
    if (isServer) {
      config.externals = [
        ...(config.externals || []),
        ({ request }: { request: string }, callback: Function) => {
          if (request?.includes('@litertjs')) {
            return callback(null, `commonjs ${request}`);
          }
          callback();
        },
      ];
    }

    return config;
  },

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
