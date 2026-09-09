/*
  An option stops being a date range and becomes a choice that may carry a date, and a poll gains
  the day it stops asking.

  `poll_options.starts_on` and `ends_on` are dropped. Any existing option keeps its identity — its
  id, its replies, its place in the order — and loses the day it referred to, which has to be typed
  again. There is no production data, so nothing is lost here; a board that had been running would
  want `label = to_char(starts_on, 'FMDy FMDD Mon')` and `on_date = starts_on` in this file instead.

  `polls.closes_on` is added with a default and then stripped of it. Prisma writes a bare NOT NULL,
  which cannot be applied to a table that already has rows — and the whole point of the column is
  that a poll created before it existed still has to stop nagging. Two weeks from the day of the
  migration is the same fallback `createPoll` uses for an ask whose options carry no dates.
*/
-- AlterTable
ALTER TABLE "poll_options" DROP COLUMN "ends_on",
DROP COLUMN "starts_on",
ADD COLUMN     "label" TEXT,
ADD COLUMN     "on_date" DATE;

-- AlterTable
ALTER TABLE "polls" ADD COLUMN "closes_on" DATE NOT NULL DEFAULT (CURRENT_DATE + 14);
ALTER TABLE "polls" ALTER COLUMN "closes_on" DROP DEFAULT;
