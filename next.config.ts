import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    unoptimized: true,
  },
  typescript: {
    tsconfigPath: './tsconfig.build.json',
  },
  // Turbopack (default in Next.js 16) handles most static assets natively.
  // Empty config acknowledges the intentional turbopack-only setup.
  turbopack: {},
};

export default nextConfig;
