import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output required for Docker/GCP Cloud Run deployment
  output: "standalone",

  // Allow builds to succeed even with type errors during development
  typescript: {
    ignoreBuildErrors: false,
  },

  eslint: {
    ignoreDuringBuilds: false,
  },
};

export default nextConfig;
