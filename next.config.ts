import createMDX from "@next/mdx";
import type { NextConfig } from "next";
import { labRedirect, legacyRedirects } from "./src/lib/redirects";

const nextConfig: NextConfig = {
  pageExtensions: ["ts", "tsx", "md", "mdx"],
  async redirects() {
    return [...legacyRedirects, ...labRedirect(process.env.NODE_ENV)];
  },
};

const withMDX = createMDX({});

export default withMDX(nextConfig);
