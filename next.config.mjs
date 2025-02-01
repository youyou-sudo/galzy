/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    optimizePackageImports: [
      "@heroui/navbar",
      "@heroui/react",
      "@heroui/system",
      "@heroui/theme",
      "@radix-ui/react-icons",
      "@radix-ui/react-select",
      "@radix-ui/react-slot",
      "@radix-ui/react-toast",
      "@react-aria/ssr",
      "@react-aria/visually-hidden",
      "motion",
      "next-themes",
      "next/image",
      "next/link",
      "react",
      "react-dom",
      "react-icons",
      "tailwindcss",
    ],
  },
};

export default nextConfig;
