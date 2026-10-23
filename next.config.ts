import type { NextConfig } from "next";

const config: NextConfig = {
  distDir: process.env.REHEARSAL_BETA === "1" ? ".next-beta" : ".next",
  serverExternalPackages: ["pdf-parse", "@napi-rs/canvas"],
  experimental: { serverActions: { bodySizeLimit: "16mb" } },
};
export default config;
