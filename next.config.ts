import type { NextConfig } from "next";

const isStaticExport = process.env.STATIC_EXPORT === '1';

const nextConfig: NextConfig = {
  output: isStaticExport ? 'export' : 'standalone',
  devIndicators: false,
  images: {
    unoptimized: isStaticExport,
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [{ protocol: 'https', hostname: '**', pathname: '/**' }],
  },
};

export default nextConfig;