import type { NextConfig } from 'next'
import type { RemotePattern } from 'next/dist/shared/lib/image-config'
import { env } from 'next-runtime-env'

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: {
    viewTransition: true,
    useCache: true,
    serverActions: { bodySizeLimit: '10mb' },
  },
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      {
        source: "/:path*", // 对所有路径生效
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value: "*", // 占位符，实际要在中间件里处理
          },
          {
            key: "Access-Control-Allow-Credentials",
            value: "true",
          },
        ],
      },
    ];
  },
}

export default nextConfig
