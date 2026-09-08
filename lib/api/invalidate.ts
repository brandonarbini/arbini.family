import "server-only";

import { revalidateTag } from "next/cache";
import { BOARD_TAGS } from "@/lib/board/cache";

/**
 * Cache invalidation for the API routes.
 *
 * The Server Actions in `app/home/where/actions.ts` use `updateTag`, which gives read-your-own-
 * writes: the very next render sees the change. That is not available here — Next's documentation
 * is explicit that `updateTag` "can **only** be called from within Server Actions. It cannot be
 * used in Route Handlers." So these use `revalidateTag`.
 *
 * The second argument is the part that matters. `revalidateTag(tag, "max")` serves the stale entry
 * while refreshing in the background, which is right for a page somebody is reading and wrong for
 * a client that refetches the instant its mutation resolves — the phone would ask for the board a
 * few milliseconds after saving and be handed the board from before the save. `{ expire: 0 }`
 * makes the next read block on fresh data instead. You tap save, the list redraws with what you
 * saved.
 *
 * (The single-argument `revalidateTag(tag)` form is deprecated in Next 16.)
 */
export function invalidateStays(): void {
  revalidateTag(BOARD_TAGS.stays, { expire: 0 });
}
