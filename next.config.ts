import { withWhopAppConfig } from "@whop/react/next.config";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    remotePatterns: [{ hostname: "**" }],
  },
  experimental: {
    turbo: {
      root: "/Users/krishaandesai/Downloads/badges",
    },
  },
};

export default withWhopAppConfig(nextConfig);
