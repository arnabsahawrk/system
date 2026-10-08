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
      {
        // The service worker script must always be re-checked, or an update
        // to it could sit unseen behind the HTTP cache.
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "no-cache, must-revalidate" }],
      },
    ];
  },
};

export default nextConfig;
