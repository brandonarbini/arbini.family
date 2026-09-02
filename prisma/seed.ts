import { FamilyRole } from "@/generated/prisma/enums";
import { env } from "@/lib/env/server";
import { prisma } from "@/lib/prisma";

/**
 * Development seed. Idempotent by construction — every write here is an upsert keyed on a unique
 * column, so re-running it must leave the database in the same state.
 *
 * Nothing in the deploy path invokes this: `prisma:initialize` migrates without seeding, and the
 * Vercel build only installs and builds. The guard in `main` covers the one remaining way it could
 * reach production — someone running `pnpm db:seed` with `DATABASE_URL` pointed somewhere real.
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

/**
 * The one place everyone comes back to. `Place.isHome` is what `lib/presence.ts` compares against
 * to decide whether the family is together, and the schema's own note asks for exactly one row
 * carrying it — so it is seeded here rather than left to be created by hand.
 */
async function seedHome() {
  return prisma.place.upsert({
    where: { name: "Home" },
    update: {},
    create: { name: "Home", isHome: true },
  });
}

/**
 * Brandon, the first account. Written with Prisma rather than through Better Auth because there is
 * no password to hash: sign-in is by magic link and passkey, both of which mint their own rows
 * against an existing user.
 *
 * `emailVerified` is true because the address is one we put in the allowlist ourselves, not one
 * someone claimed at sign-up.
 *
 * The rest of the family goes here as they are added; `sortOrder` is the board's column order, so
 * leave gaps rather than renumbering everyone when someone new arrives.
 */
async function seedBrandon() {
  const user = await prisma.user.upsert({
    where: { email: "b@arbini.dev" },
    update: {},
    create: {
      email: "b@arbini.dev",
      name: "Brandon Arbini",
      emailVerified: true,
    },
  });

  return prisma.profile.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id, role: FamilyRole.PARENT, sortOrder: 0 },
  });
}

async function main() {
  assertNotProduction();
  const home = await seedHome();
  const brandon = await seedBrandon();
  console.log(`Seeded place ${home.name} and profile ${brandon.id}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
