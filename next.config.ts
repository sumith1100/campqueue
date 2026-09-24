import type { NextConfig } from "next";

const config: NextConfig = {
  // The Docker image sets BUILD_STANDALONE=1 to get a small self-contained server.
  output: process.env.BUILD_STANDALONE === "1" ? "standalone" : undefined,
  serverExternalPackages: ["better-sqlite3"],
  poweredByHeader: false,
};

export default config;
