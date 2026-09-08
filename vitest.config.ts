import path from "path";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./vitest.env-setup.ts", "./vitest.setup.ts"],
    globalSetup: ["./vitest.global-setup.ts"],
    // Run setup files in listed order, not in parallel, so vitest.env-setup.ts rewrites the
    // per-worker DATABASE_URL before vitest.setup.ts imports anything that touches the DB.
    sequence: { setupFiles: "list" },
    passWithNoTests: true,
    // The Expo app is a separate install with its own toolchain; its tests are not run by
    // this suite, which is pinned to `environment: "node"` and a real Postgres.
    exclude: [...configDefaults.exclude, "mobile/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
});
