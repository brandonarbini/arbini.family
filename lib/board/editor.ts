import "server-only";

import {
  type BoardPresence,
  type FamilyMember,
  getFamilyMembers,
  getPresenceForProfile,
} from "@/lib/board/data";
import { type CalendarDate, addCalendarDays } from "@/lib/dates";
import { type Horizon, horizonFrom } from "@/lib/presence/derive";
import type { FamilyRole } from "@/generated/prisma/enums";

/**
 * Reads for the Around strip.
 *
 * Whose strips are offered depends on who is asking: a parent maintains everyone's travel, so
 * showing them only their own would hide the rows they most often need to fix. That decision is
 * made here from an already-resolved role rather than by reading the session — `page.tsx` does
 * the auth and passes the answer in.
 */

/** How many days the strip shows at once. Two weeks is about as far as a family plans in taps. */
export const STRIP_DAYS = 14;

export interface Strip {
  member: FamilyMember;
  runs: BoardPresence[];
  /** How far ahead they have said anything — see `horizonFrom`. */
  horizon: Horizon;
}

export async function getStripData(
  actor: { profileId: string; role: FamilyRole },
  today: CalendarDate,
) {
  const members = await getFamilyMembers();

  const editable =
    actor.role === "PARENT"
      ? members
      : members.filter((member) => member.profileId === actor.profileId);

  const strips: Strip[] = await Promise.all(
    editable.map(async (member) => {
      const runs = await getPresenceForProfile(member.profileId);
      return {
        member,
        runs,
        horizon: horizonFrom(runs, member.profileId, today),
      };
    }),
  );

  return {
    members,
    editable,
    strips,
    today,
    /** The last day the strip draws — the horizon the "said through" line is measured against. */
    through: addCalendarDays(today, STRIP_DAYS - 1),
  };
}

export type StripData = Awaited<ReturnType<typeof getStripData>>;
