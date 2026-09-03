import "dotenv/config";
import { defineConfig } from "prisma/config";

// The CLI's connection string, which is not always the app's. `prisma migrate deploy` takes a
// Postgres advisory lock, and a pooler in transaction mode hands consecutive statements to
// different backends — so the lock is taken on one connection and the migration runs on another,
// and the deploy hangs or fails. Neon (and the Vercel integration that provisions it) publishes
// the direct endpoint as DATABASE_URL_UNPOOLED alongside the pooled DATABASE_URL for exactly this.
//
// Falls back to DATABASE_URL, which is right everywhere the two are the same: the devcontainer's
// local Postgres has no pooler in front of it. The Vitest harness sets both to its template
// database (test/db.ts) so either resolution order lands on the same place.
//
// Blank counts as absent, matching `withoutEmptyStrings` in lib/env/parse.ts: a variable that
// exists in Vercel with an empty value would otherwise satisfy `??` and hand the CLI "", which
// fails as a connection-string parse error that names nothing useful.
const nonEmpty = (value: string | undefined) =>
  value && value.trim() !== "" ? value : undefined;

const migrationUrl =
  nonEmpty(process.env.DATABASE_URL_UNPOOLED) ??
  nonEmpty(process.env.DATABASE_URL);

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: migrationUrl!,
  },
});
