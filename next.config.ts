import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@react-pdf/renderer"],
  experimental: {
    optimizePackageImports: ["lucide-react", "@tabler/icons-react"],
  },
  images: {
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
