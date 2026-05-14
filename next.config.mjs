import { fileURLToPath } from 'url';
/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV !== 'production';

const nextConfig = {
  // ── Output ──────────────────────────────────────────────────────────────────
  // Standalone mode only in production (file-tracing is expensive in dev)
  ...(isDev ? {} : { output: 'standalone' }),

  // ── Compression ─────────────────────────────────────────────────────────────
  compress: true,

  // ── Compiler ────────────────────────────────────────────────────────────────
  // Automatically strip all console.log/info/warn from production builds
  // but keep console.error for error tracking. Leaves logs intact in local dev.
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error'],
    } : false,
  },

  // ── Images ──────────────────────────────────────────────────────────────────
  images: {
    // Serve optimised WebP / AVIF instead of raw JPEG/PNG
    formats: ['image/webp', 'image/avif'],
    // Allow B2 presigned URLs as external image sources
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.backblazeb2.com',
      },
    ],
  },

  // ── TypeScript ──────────────────────────────────────────────────────────────
  typescript: {
    ignoreBuildErrors: true,
  },
  // Note: ESLint config for Next.js 16 is read from the project root (.eslintrc)
  // The `eslint` key inside next.config is not recognised in Next.js 16+

  // ── Server external packages ─────────────────────────────────────────────────
  // These are large native packages that should NOT be bundled by Webpack
  serverExternalPackages: ['@prisma/client', 'bcrypt'],

  // ── Bundle optimisation ──────────────────────────────────────────────────────
  experimental: {
    // Tree-shake heavy icon/utility libraries in production only
    // In dev this analysis adds overhead without benefit
    ...(isDev ? {} : {
      optimizePackageImports: [
        'lucide-react',
        'date-fns',
        'recharts',
        'framer-motion',
        'zod',
        '@hookform/resolvers',
      ],
    }),
  },

  // ── Webpack persistent disk cache ───────────────────────────────────────────
  // Caches compiled modules to .next/cache/webpack between server restarts.
  // After the FIRST compile, subsequent restarts skip re-compiling unchanged
  // modules — turning a 60s cold start into a ~5s warm start.
  webpack(config, { dev, isServer }) {
    if (dev) {
      config.cache = {
        type: 'filesystem',
        buildDependencies: {
          // Convert file:// URL → plain OS path (webpack requires a path, not a URL)
          config: [fileURLToPath(import.meta.url)],
        },
      };
    }
    return config;
  },

  // ── Security & Caching headers ───────────────────────────────────────────────
  async headers() {
    return [
      // Security headers on every route
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options',           value: 'DENY' },
          { key: 'X-Content-Type-Options',     value: 'nosniff' },
          { key: 'Referrer-Policy',            value: 'origin-when-cross-origin' },
          { key: 'X-XSS-Protection',           value: '1; mode=block' },
        ],
      },
      // Static assets: long-lived cache (Next.js content-hashes the filenames)
      {
        source: '/_next/static/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      // Public images / manifest / sw
      {
        source: '/(favicon.ico|manifest.json|sw.js|robots.txt)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' },
        ],
      },
      // API routes: NO public cache — data is user/shop-specific & auth-gated
      // Individual routes can opt-in to caching with their own headers
      {
        source: '/api/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' },
          { key: 'Pragma',        value: 'no-cache' },
        ],
      },
    ];
  },
};

export default nextConfig;
