import { defineConfig } from "vitest/config";

// Yours. dev-env owns vitest.config.ts and rewrites it on every apply; whatever this file exports is
// merged into it (arrays concatenate, so an `exclude` here adds to the owned one rather than
// replacing it). This is where a project declares what only it knows about its own suite -- a
// directory whose tests belong to another toolchain, a timeout, an extra alias. Scaffolded once and
// never rewritten.
export default defineConfig({
  test: {},
});
