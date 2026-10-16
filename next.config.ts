import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  cacheComponents: true,
  partialPrefetching: true,
  outputFileTracingExcludes: {
    "/*": ["./.local-firmware/**/*"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
