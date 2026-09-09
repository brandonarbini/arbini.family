/**
 * Cache tags for the board.
 *
 * Shared rather than route-private because both `/home` and `/home/around` read these, and
 * `/home/around`'s actions invalidate them — the moment a tag is touched from outside the
 * directory that reads it, it belongs here.
 *
 * Constants, never string literals at the call site: a typo in an invalidation string is silent,
 * and the symptom is stale data that nobody can reproduce.
 */
export const BOARD_TAGS = {
  /** Everyone on the board. Changes only when a profile is added or edited. */
  members: "board:members",
  /**
   * Everything anybody has said about being around. One tag rather than one per person: the
   * board's derived answers — who is around, the next gathering — depend on *all* the rows, so a
   * change to anyone's invalidates the lot. Per-person tags would leave the countdown stale after
   * somebody else painted a trip onto their strip.
   */
  presence: "board:presence",
  /** Dated one-offs. */
  events: "board:events",
  /**
   * Every poll, its options and its replies under one tag.
   *
   * Answering is the one place on the board where five people are looking at the same screen at
   * the same time, and what each of them is waiting to see is somebody else's answer appear. A
   * finer-grained tag would buy nothing: there is no read of a poll that does not also want its
   * replies.
   */
  polls: "board:polls",
} as const;
