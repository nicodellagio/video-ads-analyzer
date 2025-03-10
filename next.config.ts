/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    // Exclure les packages natifs du bundle client
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        child_process: false,
      };
    }

    // Exclure les packages ffmpeg et ffprobe du bundle
    config.externals = [...(config.externals || []), 'fluent-ffmpeg', '@ffprobe-installer/ffprobe'];

    return config;
  },
};

export default nextConfig;
