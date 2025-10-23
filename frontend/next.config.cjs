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
    // Use the cleaned HeartbeatWorker from public directory for both server and client
    config.resolve = config.resolve || {};
    config.resolve.alias = config.resolve.alias || {};
    
    // Multiple aliases to catch different ways the file might be referenced
    config.resolve.alias['HeartbeatWorker.js'] = require('path').resolve(__dirname, 'public/HeartbeatWorker.js');
    config.resolve.alias['HeartbeatWorker'] = require('path').resolve(__dirname, 'public/HeartbeatWorker.js');
    config.resolve.alias['@coinbase/wallet-sdk/dist/sign/walletlink/relay/connection/HeartbeatWorker.js'] = require('path').resolve(__dirname, 'public/HeartbeatWorker.js');
    
    // Add a custom loader to handle HeartbeatWorker files
    config.module = config.module || {};
    config.module.rules = config.module.rules || [];
    config.module.rules.push({
      test: /HeartbeatWorker.*\.js$/,
      use: [
        {
          loader: require('path').resolve(__dirname, 'scripts/remove-export-loader.js')
        }
      ]
    });
    
    // Add a plugin to completely replace the problematic file
    config.plugins = config.plugins || [];
    config.plugins.push(
      new (require('webpack')).NormalModuleReplacementPlugin(
        /HeartbeatWorker.*\.js$/,
        require('path').resolve(__dirname, 'public/HeartbeatWorker.js')
      )
    );
    
    return config;
  },
};

module.exports = nextConfig;