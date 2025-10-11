import type { NextConfig } from "next";
import { config } from 'dotenv';

const nextConfig: NextConfig = {
  trailingSlash: false,
  reactStrictMode: true,
  devIndicators: false
};

config({ path: './app/___env-config/.env.dev' })

export default nextConfig;
