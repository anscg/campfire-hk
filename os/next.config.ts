import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    const apiUrl = process.env.INTERNAL_API_URL ?? "http://localhost:3001";
    return [
      {
        // Route Handlers (src/app/api/**) take priority over rewrites,
        // so SSE endpoints are handled by their streaming route handlers.
        // Everything else is proxied to the Express server.
        source: "/api/:path*",
        destination: `${apiUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
