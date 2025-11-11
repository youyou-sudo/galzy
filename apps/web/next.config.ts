import createMDX from '@next/mdx'
import type { NextConfig } from 'next'
import withBundleAnalyzer from '@next/bundle-analyzer'

// 配置分析器
const withAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
})

const nextConfig: NextConfig = {
  output: 'standalone',
  reactCompiler: true,
  images: {
    unoptimized: true,
  },
  pageExtensions: ['js', 'jsx', 'md', 'mdx', 'ts', 'tsx'],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
          {
            key: 'Access-Control-Allow-Credentials',
            value: 'true',
          },
        ],
      },
    ]
  },
}

// 配置 MDX
const withMDX = createMDX({
  extension: /\.(md|mdx)$/,
})

// 按顺序组合插件
export default withAnalyzer(withMDX(nextConfig))
