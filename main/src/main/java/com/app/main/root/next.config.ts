import type { NextConfig } from "next";
import { config } from 'dotenv';

const nextConfig: NextConfig = {
  trailingSlash: false,
  reactStrictMode: true,
  devIndicators: false,
  webpack: (config) => {
    config.module.rules.push({
      test: /\.wgsl$/,
      use: 'raw-loader'
    });
    return config;
  },
  experimental: {
    turbo: {
      rules: {
        '*.wgsl': {
          loaders: ['raw-loader'],
          as: '*.txt'
        }
      }
    }
  },
  async rewrites() {
    return [
      {
        source: '/.shaders/:path*',
        destination: '/.shaders/:path*',
      },
    ];
  },
};

const envFile = process.env.NODE_ENV === 'production'
  ? './.env-config/.env.prod'
  : './.env-config/.env.dev';

console.log(`Loading env: ${process.env.NODE_ENV}, file: ${envFile}`);
config({ path: envFile });

export default nextConfig;