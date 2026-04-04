import type { NextConfig } from 'next';

const PYTHON_API = process.env.PYTHON_API_URL ?? 'http://localhost:8000';

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${PYTHON_API}/api/:path*` },
      { source: '/auth/:path*', destination: `${PYTHON_API}/auth/:path*` },
    ];
  },
  // Turbopack (default in Next.js 16) handles most static assets natively.
  // Empty config acknowledges the intentional turbopack-only setup.
  turbopack: {},
};

export default nextConfig;
