import type { NextConfig } from "next";
import { config } from 'dotenv';

const nextConfig: NextConfig = {
  trailingSlash: false,
  reactStrictMode: true,
  devIndicators: false,
  fastRefresh: false,
  
  webpack: (config) => {
    config.watchOptions = {
      ...config.watchOptions,
      ignored: [
        '**/node_modules',
        '**/.git',
        '**/session-keys.ts',
        '**/_keys/**',
        'session-keys.ts',
        '**/_crypto/**/session-keys.ts'
      ]
    };
    
    return config;
  }
};

const envFile = process.env.NODE_ENV === 'production'
  ? './.env-config/.env.prod'
  : './.env-config/.env.dev';

console.log(`Loading env: ${process.env.NODE_ENV}, file: ${envFile}`);
config({ path: envFile });

export default nextConfig;