import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@open-wallet-standard/core"],
  async redirects() {
    return [
      // The OWS-era email list is retired; readers subscribe through their agent in PayBox.
      { source: "/subscribe", destination: "/#paybox", permanent: false },
      { source: "/leaderboard", destination: "/agents", permanent: false },
    ];
  },
};

export default nextConfig;
