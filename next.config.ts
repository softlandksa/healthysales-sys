import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  experimental: {
    ppr: false,
  },
  images: {
    formats: ["image/avif", "image/webp"],
  },
  // Set NEXT_OUTPUT=standalone for smaller Docker images
  ...(process.env.NEXT_OUTPUT === "standalone" ? { output: "standalone" } : {}),
};

export default withNextIntl(nextConfig);
