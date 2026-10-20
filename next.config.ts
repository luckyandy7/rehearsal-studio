import type { NextConfig } from "next";

const config: NextConfig = {
  serverExternalPackages: ["pdf-parse", "@napi-rs/canvas"],
  experimental: { serverActions: { bodySizeLimit: "16mb" } },
};
export default config;
