import { PrismaPg } from "@prisma/adapter-pg";
import type { PoolConfig } from "pg";
import { Prisma, PrismaClient } from "@/generated/prisma/client";
import { env } from "@/lib/env/server";

// Parse DATABASE_URL ourselves rather than passing it as `connectionString`, so
// pg-connection-string never sees `sslmode=require` and doesn't emit its v3
// deprecation warning. `rejectUnauthorized: true` matches the current
// `sslmode=require` → `verify-full` aliasing behavior.
function poolConfigFromDatabaseUrl(raw: string): PoolConfig {
  const url = new URL(raw);
  const sslmode = url.searchParams.get("sslmode");
  const ssl =
    sslmode && sslmode !== "disable" ? { rejectUnauthorized: true } : undefined;

  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 5432,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1),
    ssl,
  };
}

const adapter = new PrismaPg(poolConfigFromDatabaseUrl(env.DATABASE_URL));

// Reuse one client across hot reloads; a new pool per reload exhausts Postgres
// connections in development. The Vitest harness in test/db.ts also reads this
// global — `truncateAllTables()` is a no-op until a test imports this module,
// which is what keeps the pure-function suites from touching a database.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export { Prisma };
