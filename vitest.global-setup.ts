/**
 * Provisions the per-worker test databases before the suite runs.
 *
 * Ensures a migrated template database exists (rebuilt only when the migrations
 * directory hash changes), then drops and re-clones one private database per
 * worker. There is no teardown: worker databases are left in place for
 * post-mortem inspection, and the next run drops and reclones them.
 */

import {
  adminClient,
  defaultWorkerCount,
  ensureTemplateDatabase,
  provisionWorkerDatabases,
} from "./test/db";

// Vitest moved this type between majors — "vitest/node" stopped exporting GlobalSetupContext in
// v4 — and the harness reads exactly one field from it. Declaring the shape locally keeps the
// generated file compiling across vitest versions instead of pinning it to whichever export the
// installed major happens to have.
type GlobalSetupContext = { config: { maxWorkers: number } };

export async function setup(ctx: GlobalSetupContext) {
  const admin = adminClient();
  try {
    await ensureTemplateDatabase(admin);
    await provisionWorkerDatabases(
      admin,
      defaultWorkerCount(ctx.config.maxWorkers),
    );
  } finally {
    await admin.$disconnect();
  }
}
