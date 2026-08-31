import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
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
