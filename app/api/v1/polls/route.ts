import { requireProfileActor } from "@/lib/api/guard";
import { apiError, jsonOk } from "@/lib/api/http";
import { toPollDto } from "@/lib/api/v1/serialize";
import { getFamilyMembers, getPolls } from "@/lib/board/data";
import { todayInFamilyTz } from "@/lib/dates";

/**
 * Every poll worth showing, newest first.
 *
 * Settled polls stay in the list — the answer is the point, and hiding it the moment it is decided
 * would make the app worse than the fridge door. Polls whose dates have all passed are dropped:
 * an unsettled poll about last month is not a question anymore.
 */
export async function GET(): Promise<Response> {
  const result = await requireProfileActor();
  if (!result.ok) return result.response;

  const { actor } = result;
  const today = todayInFamilyTz();

  try {
    const [polls, members] = await Promise.all([
      getPolls(),
      getFamilyMembers(),
    ]);

    const live = polls.filter(
      (poll) => poll.status === "SETTLED" || poll.closesOn >= today,
    );

    return jsonOk(
      live.map((poll) => toPollDto(poll, members, actor.profileId, actor.id)),
    );
  } catch (error) {
    console.error("[api/v1/polls] failed to load asks", error);
    return apiError("internal", "The asks could not be loaded.");
  }
}
