import type { NextConfig } from "next";
import { legacyRedirects } from "./src/lib/redirects";

const nextConfig: NextConfig = {
  async redirects() {
    return legacyRedirects;
  },
};

export default nextConfig;
