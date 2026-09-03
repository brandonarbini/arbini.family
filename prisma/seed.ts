import { env } from "@/lib/env/server";
import { prisma } from "@/lib/prisma";
import { FAMILY, provisionFamily, provisionPlaces } from "./roster";

/**
 * Development seed. The roster and the writes live in `prisma/roster.ts`; this file is only the
 * development entry point into them, and the guard that keeps them away from production.
 *
 * The deploy path never invokes this: the Vercel build migrates but does not seed. The guard in
 * `main` covers the one remaining way it could reach production — someone running `pnpm db:seed`
 * with `DATABASE_URL` pointed somewhere real. Provisioning a real database is the deliberate,
 * confirmation-gated job of `scripts/provision-family.ts` instead.
 */

// Keyed on `VERCEL_ENV` rather than `NODE_ENV`: `NODE_ENV` is "production" during an ordinary
// local build, so it cannot tell the two apart.
function assertNotProduction(): void {
  if (env.VERCEL_ENV === "production") {
    throw new Error(
      "Refusing to seed: VERCEL_ENV is production. This seed writes family accounts directly.",
    );
  }
}

async function main() {
  assertNotProduction();
  const placeIds = await provisionPlaces();
  await provisionFamily();
  console.log(
    `Seeded ${FAMILY.length} family member(s) and ${placeIds.size} place(s): ${[...placeIds.keys()].join(", ")}.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
