import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: __dirname,
  trailingSlash: false,
  reactStrictMode: true,
  devIndicators: false
};

export default nextConfig;
