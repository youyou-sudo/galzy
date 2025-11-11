import createMDX from '@next/mdx'
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    unoptimized: true,
  },
  pageExtensions: ['js', 'jsx', 'md', 'mdx', 'ts', 'tsx'],
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
const withMDX = createMDX({
  // Add markdown plugins here, as desired
  extension: /\.(md|mdx)$/,

})
export default withMDX(nextConfig)
