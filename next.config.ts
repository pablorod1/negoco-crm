import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    viewTransition: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
      },
      {
        protocol: "https",
        hostname: "beenergy.vercel.app",
      },
      {
        protocol: "http",
        hostname: "localhost",
      },
      // For demo PDF URLs in office conversion
      {
        protocol: "https",
        hostname: "www.w3.org",
      },
      {
        protocol: "https",
        hostname: "www.africau.edu",
      },
    ],
  },
  allowedDevOrigins: [
    "http://localhost:3000",
    "http://test.localhost:3000",
    "http://beenergy.localhost:3000",
  ],
  // Configure webpack for react-pdf
  webpack: (config, { isServer }) => {
    // Handle react-pdf worker configuration
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        canvas: false,
      };
    }

    // Copy react-pdf worker files to public directory
    config.module.rules.push({
      test: /pdf\.worker\.(min\.)?js/,
      type: "asset/resource",
      generator: {
        filename: "static/worker/[hash][ext][query]",
      },
    });

    return config;
  },

  // Headers for PDF worker CORS
  async headers() {
    return [
      {
        source: "/pdf.worker.js",
        headers: [
          {
            key: "Cross-Origin-Embedder-Policy",
            value: "require-corp",
          },
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
