import "server-only";

import {
  getFamilyMembers,
  getPlaces,
  getStaysForProfile,
} from "@/lib/board/data";
import type { FamilyRole } from "@/generated/prisma/enums";

/**
 * Reads for the stay editor.
 *
 * Which stays are listed depends on who is asking: a parent maintains everyone's travel, so
 * showing them only their own would hide the rows they most often need to fix. That decision is
 * made here from an already-resolved role rather than by reading the session — `page.tsx` does
 * the auth and passes the answer in.
 */
export async function getEditorData(actor: {
  profileId: string;
  role: FamilyRole;
}) {
  const [members, places] = await Promise.all([
    getFamilyMembers(),
    getPlaces(),
  ]);

  const editable =
    actor.role === "PARENT"
      ? members
      : members.filter((member) => member.profileId === actor.profileId);

  const stayLists = await Promise.all(
    editable.map(async (member) => ({
      member,
      stays: await getStaysForProfile(member.profileId),
    })),
  );

  return { members, places, editable, stayLists };
}

export type EditorData = Awaited<ReturnType<typeof getEditorData>>;
