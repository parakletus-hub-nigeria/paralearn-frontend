import type { NextConfig } from "next";
import { config as loadEnv } from "dotenv";

// Explicitly load .env files so variables are available in next.config.ts
// (required when using Turbopack or TypeScript config files)
loadEnv({ path: ".env.local", override: true });
loadEnv({ path: ".env", override: false });

const nextConfig: NextConfig = {
  /* config options here */
  async rewrites() {
    return [
      {
        source: "/api/proxy/:path*",
        destination: `${process.env.K12_BACKEND_URL}/:path*`,
      },
      {
        source: "/api/uni-proxy/:path*",
        destination: `${process.env.UNI_BACKEND_URL || "http://localhost:3001"}/:path*`,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "arua.org",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/**",
      },
    ],
  },
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // !! WARN !!
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
