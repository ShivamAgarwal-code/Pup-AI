/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  // Allow connections from any host
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'X-Requested-With, Content-Type, Authorization' }
        ],
      },
    ]
  },
  webpack(config, { isServer }) {
    if (!isServer) {
      // Use the cleaned HeartbeatWorker from public directory
      config.resolve = config.resolve || {};
      config.resolve.alias = config.resolve.alias || {};
      config.resolve.alias['HeartbeatWorker.js'] = require('path').resolve(__dirname, 'public/HeartbeatWorker.js');
    }
    return config;
  },
};

module.exports = nextConfig;