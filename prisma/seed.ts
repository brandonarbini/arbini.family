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
 * The family.
 *
 * `sortOrder` is the board's row order — parents first, then the kids. Gaps of ten so somebody can
 * be slotted in without renumbering everyone.
 *
 * Birthdays are left null rather than guessed. The board derives every birthday from this column,
 * so a wrong date here is a wrong date on the board every year until somebody notices; fill them
 * in and re-run, and the upsert below will carry the change through.
 *
 * Each address must also appear in `FAMILY_EMAILS` or that person cannot sign in. The allowlist is
 * checked before any mail goes out, and a seeded account is not itself permission to enter.
 */
const FAMILY = [
  {
    email: "b@arbini.com",
    name: "Brandon Arbini",
    role: FamilyRole.PARENT,
    sortOrder: 0,
    color: "#b4541f",
    birthday: null as string | null,
  },
  {
    email: "jill@arbini.com",
    name: "Jill Arbini",
    role: FamilyRole.PARENT,
    sortOrder: 10,
    color: "#7d3f8c",
    birthday: null as string | null,
  },
  {
    email: "tanner@arbini.com",
    name: "Tanner Arbini",
    role: FamilyRole.KID,
    sortOrder: 20,
    color: "#1f6fb4",
    birthday: null as string | null,
  },
  {
    email: "addison@arbini.com",
    name: "Addison Arbini",
    role: FamilyRole.KID,
    sortOrder: 30,
    color: "#1f8c6e",
    birthday: null as string | null,
  },
  {
    email: "macy@arbini.com",
    name: "Macy Arbini",
    role: FamilyRole.KID,
    sortOrder: 40,
    color: "#c2185b",
    birthday: null as string | null,
  },
];

/**
 * The one place everyone comes back to. `Place.isHome` is what the board leans on to tell "at
 * home" from "away", and the schema asks for exactly one row carrying it — so it is seeded here
 * rather than left to be created by hand.
 */
async function seedHome() {
  return prisma.place.upsert({
    where: { name: "Home" },
    update: {},
    create: { name: "Home", isHome: true },
  });
}

/**
 * Accounts are written with Prisma rather than through Better Auth because there is no password
 * to hash: magic link and passkey both mint their own rows against a user that already exists.
 *
 * `emailVerified` is true because the address is one we put in the allowlist ourselves, not one
 * somebody claimed at sign-up.
 */
async function seedFamily() {
  for (const person of FAMILY) {
    const user = await prisma.user.upsert({
      where: { email: person.email },
      update: {},
      create: { email: person.email, name: person.name, emailVerified: true },
    });

    await prisma.profile.upsert({
      where: { userId: user.id },
      // `update` carries the board-facing fields so correcting a colour or a birthday in this
      // file and re-running actually changes something. The account itself is left alone.
      update: {
        role: person.role,
        sortOrder: person.sortOrder,
        color: person.color,
        birthday: person.birthday
          ? new Date(`${person.birthday}T00:00:00Z`)
          : null,
      },
      create: {
        userId: user.id,
        role: person.role,
        sortOrder: person.sortOrder,
        color: person.color,
        birthday: person.birthday
          ? new Date(`${person.birthday}T00:00:00Z`)
          : null,
      },
    });
  }
}

async function main() {
  assertNotProduction();
  const home = await seedHome();
  await seedFamily();
  console.log(
    `Seeded ${FAMILY.length} family member(s) and the place "${home.name}".`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
