const nextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  // eslint: {
  //   ignoreDuringBuilds: true,
  // },
  experimental: {
    optimizePackageImports: ["package-name"],
  },
};

export default nextConfig;
