import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow builds to succeed even with type errors during development
  typescript: {
    ignoreBuildErrors: false,
  },

  // Tell Next.js not to bundle Prisma — use the Node.js require() instead
  // This prevents Turbopack from trying to WASM-bundle the Prisma client
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg", "pg"],
};

export default nextConfig;
