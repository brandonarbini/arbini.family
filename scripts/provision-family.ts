import { env } from "@/lib/env/server";
import { prisma } from "@/lib/prisma";
import { FAMILY, provisionFamily, provisionPlaces } from "@/prisma/roster";

/**
 * Writes the family roster into a real database. The production counterpart to `prisma/db:seed`.
 *
 * Production has no other way to get its accounts: `magicLink({ disableSignUp: true })` in
 * lib/auth.ts means a link sent to an address with no `User` row fails at verify time, so the five
 * people must exist before anyone can sign in. `prisma/seed.ts` refuses to run there on purpose,
 * and relaxing that guard would make every `pnpm db:seed` typo a production write.
 *
 * So this is a separate entry point with a different safety model: instead of refusing production,
 * it names the database it is about to write to and insists you say yes. Run it by hand, never
 * from the build:
 *
 *   DATABASE_URL='<prod url>' pnpm db:provision --yes
 *
 * `pnpm db:provision` deliberately does not load `.env`, unlike `db:seed` — the committed `.env`
 * points at the devcontainer's Postgres, and a shadowed URL here would silently provision the
 * wrong database while reporting success.
 *
 * Idempotent, because everything in `prisma/roster.ts` is: re-running it after somebody has signed
 * in refreshes their board fields and leaves their account alone.
 */

/** Enough of the connection string to recognise a database by, and nothing that is a secret. */
function describeTarget(): string {
  const url = new URL(env.DATABASE_URL);
  return `${url.hostname}${url.port ? `:${url.port}` : ""}/${url.pathname.slice(1)}`;
}

async function main() {
  const target = describeTarget();

  // Printed before the check, not after: the point is to show you what you are about to touch
  // while there is still time to decide against it. On stderr rather than stdout so it stays
  // ordered against the refusal below — split across two streams, a terminal interleaves them and
  // the refusal can surface first, which reads as if nothing was checked.
  console.error(`Target database: ${target}`);

  if (!process.argv.includes("--yes")) {
    console.error(
      "Refusing to provision without --yes. Re-run with --yes once the target above is the database you meant.",
    );
    process.exitCode = 1;
    return;
  }

  const placeIds = await provisionPlaces();
  await provisionFamily(placeIds);
  console.log(
    `Provisioned ${FAMILY.length} family member(s) and ${placeIds.size} place(s) into ${target}: ${[...placeIds.keys()].join(", ")}.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
