/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output produces a minimal `server.js` and trace-list
  // of required node_modules — perfect for slim Docker images.
  output: 'standalone',
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
};

module.exports = nextConfig;
