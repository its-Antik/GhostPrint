/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
  async rewrites() {
    return [
      { source: '/buyer', destination: '/dashboard' },
      { source: '/profile', destination: '/dashboard' },
      { source: '/dashboard-runner', destination: '/dashboard' },
      { source: '/jobs-runner', destination: '/dashboard' },
      { source: '/orders-runner', destination: '/dashboard' },
      { source: '/price-setup', destination: '/dashboard' },
      { source: '/wallet-runner', destination: '/dashboard' },
    ];
  },
};

export default nextConfig;
