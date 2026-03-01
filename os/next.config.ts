import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    const apiUrl = process.env.INTERNAL_API_URL ?? "http://localhost:3001";
    return {
      // afterFiles: Next.js checks its own route handlers FIRST (pages, app
      // directory, route handlers). Only if none match does it fall through to
      // these rewrites and proxy to Express. This ensures that any
      // src/app/api/** route handler (SSE proxy, audio proxy, etc.) is served
      // by Next.js directly without hitting Express.
      beforeFiles: [],
      afterFiles: [
        {
          source: "/api/:path*",
          destination: `${apiUrl}/api/:path*`,
        },
      ],
      fallback: [],
    };
  },
};

export default nextConfig;
