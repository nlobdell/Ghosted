import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Turbopack (default in Next.js 16) handles most static assets natively.
  // Empty config acknowledges the intentional turbopack-only setup.
  turbopack: {},
};

export default nextConfig;
