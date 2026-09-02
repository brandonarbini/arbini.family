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

/** Place names, used as the seed's join key: `Place.name` is unique, so it is a stable handle. */
const HOME = "Home";
const VANGUARD = "Vanguard";

/**
 * The family.
 *
 * `sortOrder` is the board's row order — parents first, then the kids. Gaps of ten so somebody can
 * be slotted in without renumbering everyone.
 *
 * Birthdays are the full date of birth, not just the day and month: the board reports the age
 * somebody is turning, which needs the year. Stored as `YYYY-MM-DD` strings here and converted to
 * the UTC-midnight instant a `@db.Date` column expects at the point of writing — never by handing
 * a locally-parsed `Date` to Prisma, which is where a birthday drifts a day.
 *
 * Each address must also appear in `FAMILY_EMAILS` or that person cannot sign in. The allowlist is
 * checked before any mail goes out, and a seeded account is not itself permission to enter.
 *
 * `livesAt` is where the board places somebody on a day no stay covers. Four of them live at home
 * and Addison is on campus, which is the whole reason the column exists: without it the board asks
 * everyone to record the days nothing is happening, and the answer to that request is silence.
 */
const FAMILY = [
  {
    email: "b@arbini.com",
    livesAt: HOME,
    name: "Brandon Arbini",
    role: FamilyRole.PARENT,
    sortOrder: 0,
    color: "#b4541f",
    birthday: "1979-11-02",
  },
  {
    email: "jill@arbini.com",
    livesAt: HOME,
    name: "Jill Arbini",
    role: FamilyRole.PARENT,
    sortOrder: 10,
    color: "#7d3f8c",
    birthday: "1980-03-16",
  },
  {
    email: "tanner@arbini.com",
    livesAt: HOME,
    name: "Tanner Arbini",
    role: FamilyRole.KID,
    sortOrder: 20,
    color: "#1f6fb4",
    birthday: "2005-06-14",
  },
  {
    email: "addison@arbini.com",
    livesAt: VANGUARD,
    name: "Addison Arbini",
    role: FamilyRole.KID,
    sortOrder: 30,
    color: "#1f8c6e",
    birthday: "2007-12-24",
  },
  {
    email: "macy@arbini.com",
    livesAt: HOME,
    name: "Macy Arbini",
    role: FamilyRole.KID,
    sortOrder: 40,
    color: "#c2185b",
    birthday: "2011-08-23",
  },
];

/**
 * The places the family reckons from.
 *
 * `Place.isHome` is what the board leans on to tell "at home" from "away", and the schema asks for
 * exactly one row carrying it — so it is seeded here rather than left to be created by hand.
 *
 * Vanguard is seeded alongside it because Addison lives there, and a default place that does not
 * exist yet is not a default. Both are upserts keyed on `name`, which is unique.
 */
async function seedPlaces(): Promise<Map<string, string>> {
  const places = await Promise.all([
    prisma.place.upsert({
      where: { name: HOME },
      update: {},
      create: { name: HOME, isHome: true },
    }),
    prisma.place.upsert({
      where: { name: VANGUARD },
      update: {},
      create: { name: VANGUARD, address: "Vanguard University, Costa Mesa" },
    }),
  ]);
  return new Map(places.map((place) => [place.name, place.id]));
}

/**
 * Accounts are written with Prisma rather than through Better Auth because there is no password
 * to hash: magic link and passkey both mint their own rows against a user that already exists.
 *
 * `emailVerified` is true because the address is one we put in the allowlist ourselves, not one
 * somebody claimed at sign-up.
 */
async function seedFamily(placeIds: Map<string, string>) {
  for (const person of FAMILY) {
    const defaultPlaceId = placeIds.get(person.livesAt) ?? null;

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
        defaultPlaceId,
        birthday: person.birthday
          ? new Date(`${person.birthday}T00:00:00Z`)
          : null,
      },
      create: {
        userId: user.id,
        role: person.role,
        sortOrder: person.sortOrder,
        color: person.color,
        defaultPlaceId,
        birthday: person.birthday
          ? new Date(`${person.birthday}T00:00:00Z`)
          : null,
      },
    });
  }
}

async function main() {
  assertNotProduction();
  const placeIds = await seedPlaces();
  await seedFamily(placeIds);
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
