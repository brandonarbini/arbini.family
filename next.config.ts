import "./lib/env/server"; // dev-env:tool.env@1 — validate the environment during next build
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components: opts every `"use cache"` function into the stable caching model and makes
  // uncached data access outside a Suspense boundary a build error rather than a silent
  // waterfall. The board's reads are cached and tag-invalidated on write; the pages themselves
  // stay dynamic because they read the session.
  cacheComponents: true,
};

export default nextConfig;
