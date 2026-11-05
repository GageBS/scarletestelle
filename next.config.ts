import type { NextConfig } from "next";

// Cache Components is OFF on purpose: almost every page here reads the CRM
// database, so pages render per request (`dynamic = "force-dynamic"`) and
// mutations call revalidatePath. Simpler for a DB-backed studio app.
const nextConfig: NextConfig = {
  cacheComponents: false,
  // lets phones on the home Wi-Fi use the dev server (menus, viewer, forms)
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*"],
  serverExternalPackages: ["@libsql/client", "sharp"],
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [390, 640, 828, 1080, 1440, 1920, 2400],
    qualities: [70, 80, 90],
  },
  experimental: {
    serverActions: { bodySizeLimit: "40mb" },
  },
  turbopack: {
    root: process.cwd(),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
