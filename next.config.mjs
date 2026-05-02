/** @type {import('next').NextConfig} */
const nextConfig = {
  // ── Output ──────────────────────────────────────────────────────────────────
  // Standalone mode for Docker / self-hosted deployments
  output: 'standalone',

  // ── Compression ─────────────────────────────────────────────────────────────
  // Gzip all HTML/JS/CSS at the Edge — typically 60-70% size reduction
  compress: true,

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

  // ── TypeScript / ESLint ─────────────────────────────────────────────────────
  // Keep build fast while still type-checking in CI
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },

  // ── Server external packages ─────────────────────────────────────────────────
  // These are large native packages that should NOT be bundled by Webpack
  serverExternalPackages: ['@prisma/client', 'bcrypt'],

  // ── Bundle optimisation ──────────────────────────────────────────────────────
  // Tree-shake these libraries — only the icons/functions actually imported
  // are included in the client bundle instead of the entire library
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'date-fns',
      'redis',
      '@aws-sdk/client-s3',
      '@aws-sdk/s3-request-presigner',
      '@hookform/resolvers',
      'zod',
      'framer-motion',
      'recharts'
    ],
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
