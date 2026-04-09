import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    unoptimized: true,
  },
  outputFileTracingIncludes: {
    '/api/companion/assets/[...path]': ['./assets/companion/**/*'],
    '/api/companion/render': ['./assets/companion/**/*'],
    '/api/companion/render-animated': ['./assets/companion/**/*'],
  },
  // Turbopack (default in Next.js 16) handles most static assets natively.
  // Empty config acknowledges the intentional turbopack-only setup.
  turbopack: {},
};

export default nextConfig;
