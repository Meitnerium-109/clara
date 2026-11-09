import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // CSV uploads go through server actions; the default 1 MB limit would
    // reject a full 1 MB file once form overhead is added.
    serverActions: { bodySizeLimit: "2mb" },
  },
};

export default nextConfig;
