import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: {
    viewTransition: true,
    useCache: true,
    serverActions: { bodySizeLimit: '10mb', }
  },
  images: {
    unoptimized: true,
  }
}

export default nextConfig
