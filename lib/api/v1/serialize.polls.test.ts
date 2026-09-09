import { describe, expect, it } from "vitest";
import { FamilyRole, PollStatus, ReplyKind } from "@/generated/prisma/enums";
import { toPollDto } from "@/lib/api/v1/serialize";
import { avatarPath } from "@/lib/avatars/path";
import type { BoardPoll, FamilyMember } from "@/lib/board/data";

/**
 * The poll roster on the wire.
 *
 * Names alone were enough while both clients only printed them. An avatar is fetched per
 * `profileId`, so the poll now has to say who these people *are* as well as what they are called.
 */

const MEMBERS: FamilyMember[] = [
  member("p-brandon", "Brandon Arbini", 0, FamilyRole.PARENT),
  member("p-jill", "Jill Arbini", 10, FamilyRole.PARENT),
  member("p-macy", "Macy Arbini", 20, FamilyRole.KID),
];

function member(
  profileId: string,
  name: string,
  sortOrder: number,
  role: FamilyRole,
): FamilyMember {
  return {
    profileId,
    userId: `u-${profileId}`,
    name,
    email: `${profileId}@example.test`,
    image: null,
    role,
    color: null,
    birthday: null,
    sortOrder,
  };
}

function poll(replies: { profileId: string; kind: ReplyKind }[]): BoardPoll {
  return {
    id: "poll-1",
    title: "A weekend",
    status: PollStatus.OPEN,
    settledOptionId: null,
    createdById: "u-p-brandon",
    createdByName: "Brandon Arbini",
    createdAt: new Date("2026-09-01T00:00:00Z"),
    options: [
      {
        optionId: "opt-1",
        startsOn: "2026-10-03",
        endsOn: "2026-10-04",
        sortOrder: 0,
        replies: replies.map((reply) => ({ optionId: "opt-1", ...reply })),
      },
    ],
  };
}

describe("toPollDto", () => {
  it("ships the roster in board order, with ids", () => {
    const dto = toPollDto(poll([]), MEMBERS, "p-jill", "u-p-jill");

    expect(dto.members?.map((member) => member.profileId)).toEqual([
      "p-brandon",
      "p-jill",
      "p-macy",
    ]);
    expect(dto.members?.map((member) => member.name)).toEqual([
      "Brandon Arbini",
      "Jill Arbini",
      "Macy Arbini",
    ]);
  });

  it("gives each of them a versioned avatar to fetch", () => {
    const dto = toPollDto(poll([]), MEMBERS, "p-jill", "u-p-jill");

    expect(dto.members?.map((member) => member.avatarPath)).toEqual(
      MEMBERS.map((member) => avatarPath(member.profileId, member.name)),
    );
  });

  it("maps each answer to its profile, and leaves the silent out", () => {
    const dto = toPollDto(
      poll([
        { profileId: "p-brandon", kind: ReplyKind.YES },
        { profileId: "p-jill", kind: ReplyKind.NO },
      ]),
      MEMBERS,
      "p-jill",
      "u-p-jill",
    );

    // Macy is absent rather than null: silence is its own state, and a key holding null would
    // read as an answer that happened to be empty.
    expect(dto.options[0].replyByProfileId).toEqual({
      "p-brandon": "YES",
      "p-jill": "NO",
    });
    expect(dto.options[0].silentNames).toEqual(["Macy Arbini"]);
  });
});
