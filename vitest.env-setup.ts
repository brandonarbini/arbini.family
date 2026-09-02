/**
 * First entry in setupFiles: point this worker at its private database clone
 * BEFORE any test module (and therefore the app's Prisma singleton) is imported.
 *
 * This lives in its own setup file, ahead of vitest.setup.ts, because ESM import
 * hoisting would run vitest.setup.ts's imports — eventually the Prisma singleton —
 * before any assignment in that file's body could take effect. A dedicated file
 * with no such imports guarantees the URL is rewritten first.
 *
 * Keyed on VITEST_POOL_ID (the tinypool slot: bounded and stable across watch
 * reruns), NOT VITEST_WORKER_ID, which grows unboundedly in watch mode.
 */

import { BASE_DB, withDbName, workerDb } from "./test/db";

const poolId = process.env.VITEST_POOL_ID ?? "1";

for (const key of ["DATABASE_URL", "DATABASE_URL_UNPOOLED"] as const) {
  const url = process.env[key];
  if (!url) continue;

  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    continue;
  }

  // Only rewrite the shared base test DB; leave other URLs untouched.
  if (pathname === `/${BASE_DB}`) {
    process.env[key] = withDbName(url, workerDb(poolId));
  }
}
