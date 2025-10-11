import type { NextConfig } from "next";
import { config } from 'dotenv';

const nextConfig: NextConfig = {
  trailingSlash: false,
  reactStrictMode: true,
  devIndicators: false
};

const envFile = process.env.NODE_ENV === 'production'
? './.env-config/.env.prod'
: './.env-config/.env.dev';

console.log(`Loading env: ${process.env.NODE_ENV}, file: ${envFile}`);
config({ path: envFile });

export default nextConfig;
