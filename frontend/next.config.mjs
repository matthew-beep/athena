import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function parseEnvFile(filepath) {
  try {
    return Object.fromEntries(
      readFileSync(filepath, 'utf8')
        .split('\n')
        .filter((line) => line && !line.startsWith('#') && line.includes('='))
        .map((line) => {
          const idx = line.indexOf('=');
          return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()];
        })
    );
  } catch {
    return {};
  }
}

// Read root .env so NEXT_PUBLIC_* vars don't need a separate frontend/.env.local.
// Priority: shell/Docker env vars > root .env > hardcoded defaults.
const rootEnv = parseEnvFile(resolve(__dirname, '../.env'));

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_BACKEND_URL:
      process.env.NEXT_PUBLIC_BACKEND_URL ??
      rootEnv.NEXT_PUBLIC_BACKEND_URL ??
      'http://localhost:8000',
    NEXT_PUBLIC_OLLAMA_MODEL:
      process.env.NEXT_PUBLIC_OLLAMA_MODEL ??
      rootEnv.OLLAMA_MODEL ??
      'qwen3.5:4b',
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8000/api/:path*',
      },
    ];
  },
};

export default nextConfig;
