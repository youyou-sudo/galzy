import type { NextConfig } from 'next'
import type { RemotePattern } from 'next/dist/shared/lib/image-config'
import { env } from 'next-runtime-env'

const openImageHost: RemotePattern | null = (() => {
  const envValue = env('NEXT_PUBLIC_OPENIMAG_P_HOST')
  if (!envValue) return null
  try {
    const url = new URL(envValue)
    const protocol = url.protocol.replace(':', '') as 'http' | 'https'
    return {
      protocol,
      hostname: url.hostname,
      port: url.port || undefined,
    }
  } catch {
    console.error('❌ NEXT_PUBLIC_OPENIMAG_P_HOST 格式错误')
    return null
  }
})()

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: {
    viewTransition: true,
    useCache: true,
    serverActions: { bodySizeLimit: '10mb' },
  },
  images: {
    unoptimized: true,
    // formats: ['image/avif', 'image/webp'],
    // minimumCacheTTL: 2678400,
    // remotePatterns: [
    //   {
    //     protocol: 'https',
    //     hostname: 't.vndb.org',
    //   },
    //   ...(openImageHost ? [openImageHost] : []),
    // ],
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
