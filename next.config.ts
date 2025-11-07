import {withSentryConfig} from "@sentry/nextjs";
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

export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "negoco-cloud",

  project: "javascript-nextjs",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Uncomment to route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  // tunnelRoute: "/monitoring",

  // Automatically tree-shake Sentry logger statements to reduce bundle size
  disableLogger: true,

  // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
  // See the following for more information:
  // https://docs.sentry.io/product/crons/
  // https://vercel.com/docs/cron-jobs
  automaticVercelMonitors: true,
});