import Link from "next/link";
import { Button } from "@/components/ui/button";
import { RuledList, Section } from "@/components/ui/section";
import { requireProfile } from "@/lib/auth-helpers";
import { type BoardPoll, getFamilyMembers, getPolls } from "@/lib/board/data";
import { tallyPoll } from "@/lib/polls/tally";
import { formatCalendarDate, todayInFamilyTz } from "@/lib/dates";

export const metadata = { title: "Polls — Arbini Family" };

export default async function PollsPage() {
  const actor = await requireProfile("/polls");
  const today = todayInFamilyTz();
  const [polls, members] = await Promise.all([getPolls(), getFamilyMembers()]);
  const profileIds = members.map((member) => member.profileId);

  // "Open" is derived from the dates rather than stored, so a poll whose days have passed drops
  // off the list on its own. A stored lifecycle would need something to come along and close it,
  // and nothing does.
  const isLive = (poll: BoardPoll) =>
    poll.options.some((option) => option.endsOn >= today);
  const open = polls.filter(isLive);
  const past = polls.filter((poll) => !isLive(poll));

  return (
    <div>
      <div className="mb-10 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-headline text-4xl">Polls</h1>
          <p className="font-copy mt-2 text-base text-muted-foreground">
            Ask a few dates, send the link, see who can make it.
          </p>
        </div>
        <Button asChild>
          <Link href="/polls/new">Start a poll</Link>
        </Button>
      </div>

      <Section title="Open">
        {open.length === 0 ? (
          <p className="font-copy text-base text-muted-foreground">
            Nothing open.{" "}
            <Link href="/polls/new" className="underline underline-offset-4">
              Ask about a few days
            </Link>
            .
          </p>
        ) : (
          <RuledList>
            {open.map((poll) => (
              <PollRow
                key={poll.id}
                poll={poll}
                profileIds={profileIds}
                viewerProfileId={actor.profileId}
              />
            ))}
          </RuledList>
        )}
      </Section>

      {past.length > 0 ? (
        <Section title="Past">
          <RuledList>
            {past.map((poll) => (
              <PollRow
                key={poll.id}
                poll={poll}
                profileIds={profileIds}
                viewerProfileId={actor.profileId}
              />
            ))}
          </RuledList>
        </Section>
      ) : null}
    </div>
  );
}

function PollRow({
  poll,
  profileIds,
  viewerProfileId,
}: {
  poll: BoardPoll;
  profileIds: string[];
  viewerProfileId: string;
}) {
  const replies = poll.options.flatMap((option) => option.replies);
  const tallies = tallyPoll(poll.options, replies, profileIds);
  const waiting = tallies.some((tally) =>
    tally.silentBy.includes(viewerProfileId),
  );
  const settled = poll.options.find(
    (option) => option.optionId === poll.settledOptionId,
  );

  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <Link
        href={`/polls/${poll.id}`}
        className="group flex items-center gap-3"
      >
        <span className="min-w-0 flex-1">
          <span className="font-copy block truncate text-lg group-hover:underline group-hover:underline-offset-4">
            {poll.title}
          </span>
          <span className="font-copy block text-sm text-muted-foreground">
            {settled
              ? `Settled — ${formatCalendarDate(settled.startsOn, "EEE d MMM")}`
              : `${poll.options.length} date${poll.options.length === 1 ? "" : "s"}`}
            {poll.createdByName ? ` · ${poll.createdByName.split(" ")[0]}` : ""}
          </span>
        </span>
        {/* The nudge is the strongest thing on the row on purpose: an unanswered poll is the only
            state on this page that asks anything of the person reading it. */}
        {waiting && !settled ? (
          <span className="shrink-0 rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground">
            Your turn
          </span>
        ) : null}
      </Link>
    </li>
  );
}
