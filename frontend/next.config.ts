import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  skipTrailingSlashRedirect: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "drive.google.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "dl.dropboxusercontent.com" },
      { protocol: "https", hostname: "dropbox.com" },
      { protocol: "https", hostname: "www.dropbox.com" },
    ],
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
