import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // System has no remote images and no external API surface to expose,
  // so we keep the default security headers tight.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
