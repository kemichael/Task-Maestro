import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  serverExternalPackages: ["better-sqlite3"],
  // standalone build に better-sqlite3 のネイティブバイナリ・マイグレ SQL を含める
  outputFileTracingIncludes: {
    "/**/*": ["./migrations/**/*", "./node_modules/better-sqlite3/**/*"],
  },
};

export default nextConfig;
