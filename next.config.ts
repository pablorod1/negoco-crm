import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
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
    ],
  },
  api: {
    bodyParser: {
      sizeLimit: "30mb",
    },
  },
};

export default nextConfig;
