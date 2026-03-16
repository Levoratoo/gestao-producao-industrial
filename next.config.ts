import type { NextConfig } from "next";

const repositoryName = "gestao-producao-industrial";
const isStaticExport =
  process.env.STATIC_EXPORT === "true" ||
  process.env.GITHUB_PAGES === "true";

const nextConfig: NextConfig = {
  output: isStaticExport ? "export" : undefined,
  basePath: isStaticExport ? `/${repositoryName}` : undefined,
  assetPrefix: isStaticExport ? `/${repositoryName}/` : undefined,
  trailingSlash: isStaticExport,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
