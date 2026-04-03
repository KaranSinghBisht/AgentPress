import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "@open-wallet-standard/core"],
};

export default nextConfig;
