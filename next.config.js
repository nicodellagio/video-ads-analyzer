/** @type {import('next').NextConfig} */
const nextConfig = {
  // Augmenter la taille maximale des assets statiques
  experimental: {
    largePageDataBytes: 128 * 1000, // 128KB
  },
  // Désactiver le linting lors du build
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Désactiver la vérification des types lors du build
  typescript: {
    ignoreBuildErrors: true,
  },
  // Configuration des fonctions serverless
  serverRuntimeConfig: {
    maxDuration: 60, // 60 secondes maximum pour les fonctions serverless
  },
  serverExternalPackages: [
    'fluent-ffmpeg',
    '@ffprobe-installer/ffprobe',
    'child_process',
    '@ffmpeg-installer/ffmpeg',
    'got'
  ],
  webpack: (config, { isServer }) => {
    // Ajouter un fallback pour les modules qui utilisent le browser globals
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        stream: false,
      };
    }
    return config;
  },
};

module.exports = nextConfig; 