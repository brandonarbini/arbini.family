import path from "path";
import { defineConfig } from "vitest/config";

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
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
});
