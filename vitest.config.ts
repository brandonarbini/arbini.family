import path from "path";
import { configDefaults, defineConfig, mergeConfig } from "vitest/config";
import project from "./vitest.project";

// mergeConfig rather than a bare object: vitest.project.ts is the project's own half, scaffolded
// once and never rewritten, and merging (arrays concatenate) is what lets it add an exclusion or an
// alias without this file -- which is rewritten on every apply -- having to carry it.
export default mergeConfig(
  defineConfig({
    test: {
      globals: true,
      environment: "node",
      setupFiles: ["./vitest.env-setup.ts", "./vitest.setup.ts"],
      globalSetup: ["./vitest.global-setup.ts"],
      // Run setup files in listed order, not in parallel, so vitest.env-setup.ts rewrites the
      // per-worker DATABASE_URL before vitest.setup.ts imports anything that touches the DB.
      sequence: { setupFiles: "list" },
      // `.context/` is the gitignored scratch directory each Conductor worktree gets for agent
      // collaboration. Scratch files there are not the project's tests, and collecting them lets a
      // throwaway spike fail `pnpm test:run` for everyone in the worktree. One repository found this
      // and fixed it by hand; owning the config means every repository gets the exclusion.
      exclude: [...configDefaults.exclude, ".context/**"],
      passWithNoTests: true,
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./"),
      },
    },
  }),
  project,
);
