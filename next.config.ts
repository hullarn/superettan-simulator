import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  allowedDevOrigins: ['127.0.0.1'],
  deploymentId: process.env.NEXT_DEPLOYMENT_ID,
  async headers() {
    const noIndexHeaders = [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }];
    return [
      { source: '/admin', headers: noIndexHeaders },
      { source: '/api/:path*', headers: noIndexHeaders },
    ];
  },
  webpack(config, { webpack }) {
    config.module.rules.push({
      test: /highs\.wasm$/,
      type: 'asset/resource',
    });
    config.plugins.push(
      new webpack.IgnorePlugin({ resourceRegExp: /^node:(fs|crypto)$/ }),
    );
    return config;
  },
};

export default nextConfig;
