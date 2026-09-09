import { requireProfileActor } from "@/lib/api/guard";
import { apiError, jsonOk } from "@/lib/api/http";
import { toBoardDto } from "@/lib/api/v1/serialize";
import { getBoardView, getPollsAwaiting } from "@/lib/board/view";
import { todayInFamilyTz } from "@/lib/dates";

/**
 * The board, for the phone. The same reads `/home` renders, serialised.
 *
 * `getBoardView` is `"use cache"` all the way down. Next's own documentation notes that `use cache`
 * cannot appear in a Route Handler's body but works fine in a helper the handler calls — which is
 * what these already are, so nothing needed restructuring. The handler itself is request-time
 * regardless, the moment it reads the session.
 *
 * On serverless, in-memory cache entries frequently do not survive between instances, so in
 * production this buys the correctness of the pattern more than it buys latency. That is the same
 * bargain `/home` already makes.
 */
export async function GET(): Promise<Response> {
  const result = await requireProfileActor();
  if (!result.ok) return result.response;

  const { actor } = result;

  // Resolved here, in the family's timezone, and never taken from the request. A phone in another
  // timezone asking for "its" today would see a different board than the one on the fridge — and
  // the reads underneath are cached on their arguments, so a client-supplied date would also
  // poison the cache with somebody else's idea of the day.
  const today = todayInFamilyTz();

  try {
    const [view, awaiting] = await Promise.all([
      getBoardView(today),
      getPollsAwaiting(actor.profileId, today),
    ]);

    return jsonOk(toBoardDto(view, awaiting, actor.id, actor.profileId, actor));
  } catch (error) {
    // The client cannot act on a database failure, and the message would leak shapes it has no
    // business knowing. Log the cause, return the category.
    console.error("[api/v1/board] failed to assemble the board", error);
    return apiError("internal", "The board could not be loaded.");
  }
}
