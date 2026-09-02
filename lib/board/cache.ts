/**
 * Cache tags for the board.
 *
 * Shared rather than route-private because both `/home` and `/home/where` read these, and
 * `/home/where`'s actions invalidate them — the moment a tag is touched from outside the
 * directory that reads it, it belongs here.
 *
 * Constants, never string literals at the call site: a typo in an invalidation string is silent,
 * and the symptom is stale data that nobody can reproduce.
 */
export const BOARD_TAGS = {
  /** Everyone on the board. Changes only when a profile is added or edited. */
  members: "board:members",
  /** The places people can be. */
  places: "board:places",
  /**
   * Every stay. One tag rather than one per person: the board's derived answers — who is where,
   * the next gathering — depend on *all* the stays, so a change to anyone's invalidates the lot.
   * Per-person tags would leave the countdown stale after somebody else's trip moved.
   */
  stays: "board:stays",
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
