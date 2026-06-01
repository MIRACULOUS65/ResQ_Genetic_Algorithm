import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Allow Leaflet CDN images for marker icons
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdnjs.cloudflare.com',
      },
    ],
  },
};

export default nextConfig;
