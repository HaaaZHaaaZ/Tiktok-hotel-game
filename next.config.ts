import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  turbopack: {},
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  // Allow access to remote image placeholder.
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**', // This allows any path under the hostname
      },
    ],
  },
  output: 'standalone',
  transpilePackages: ['motion'],
  webpack: (config, {dev}) => {
    // HMR is disabled in AI Studio via DISABLE_HMR env var.
    // Do not modify—file watching is disabled to prevent flickering during agent edits.
    if (dev && process.env.DISABLE_HMR === 'true') {
      config.watchOptions = {
        ignored: /.*/,
      };
    }

    // `ws` (via tiktok-live-connector) hace require('bufferutil'), una dep NATIVA
    // OPCIONAL. Al bundlear para el servidor, Next la resuelve a un stub vacio
    // `39727:()=>{}` en vez de fallar, asi que el `try/catch` de `ws` NO la
    // captura y se queda con `b.mask is not a function`. Eso mata el socket de
    // TikTok a los ~20s (verificado por reproduccion).
    //
    // OJO: `resolve.alias = {bufferutil: false}` NO sirve — webpack tambien lo
    // sustituye por un modulo vacio, o sea el mismo stub. Lo que funciona es
    // dejarlas como EXTERNAS: el require real lanza MODULE_NOT_FOUND en runtime,
    // el try/catch de `ws` si lo captura y cae a su implementacion JS pura.
    // Refuerzo en runtime: server.js fija WS_NO_BUFFER_UTIL=1 y
    // WS_NO_UTF_8_VALIDATE=1 antes de require('next').
    config.externals = [...(config.externals || []), 'bufferutil', 'utf-8-validate'];

    return config;
  },
};

export default nextConfig;
