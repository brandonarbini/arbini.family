import Link from "next/link";
import {
  AGENDA_WINDOW_DAYS,
  getBoardView,
  getPollsAwaiting,
} from "@/lib/board/view";
import { Fortnight, type FortnightRow } from "@/app/home/fortnight";
import { canEditProfile } from "@/lib/board/permissions";
import type { FamilyRole } from "@/generated/prisma/enums";
import { PersonBadge } from "@/components/person-badge";
import { RuledList, Section } from "@/components/ui/section";
import { requireAuth } from "@/lib/auth-helpers";
import type { BoardPoll } from "@/lib/board/data";
import type { AgendaEntry } from "@/lib/board/agenda";
import {
  describeRelativeDay,
  formatCalendarDate,
  todayInFamilyTz,
} from "@/lib/dates";

export const metadata = { title: "The board — Arbini Family" };

export default async function BoardPage() {
  const user = await requireAuth();
  // Read here rather than inside the data layer: the cached queries key on their arguments, so
  // the clock has to be consulted outside them or "today" would be frozen into a cache entry.
  const today = todayInFamilyTz();
  const [board, awaiting] = await Promise.all([
    getBoardView(today),
    user.profileId ? getPollsAwaiting(user.profileId, today) : [],
  ]);

  return (
    <div>
      <YourTurn polls={awaiting} viewerUserId={user.id} />
      <Today board={board} />
      <Gathering board={board} viewerProfileId={user.profileId} />
      <TheFortnight board={board} user={user} />
      <Agenda board={board} />
    </div>
  );
}

/**
 * Polls waiting on you, above everything else.
 *
 * Above the lede on purpose, and the only thing on the board that asks the reader for something
 * rather than telling them something. It renders nothing at all when there is nothing waiting —
 * a permanent empty "no polls" slot would train people to stop looking at exactly the place the
 * ask appears.
 */
function YourTurn({
  polls,
  viewerUserId,
}: {
  polls: BoardPoll[];
  viewerUserId: string;
}) {
  if (polls.length === 0) return null;

  return (
    <Section title="Your turn">
      <RuledList>
        {polls.map((poll) => (
          <li key={poll.id} className="py-2 first:pt-0 last:pb-0">
            <Link
              href={`/polls/${poll.id}`}
              className="font-copy text-lg underline underline-offset-4"
            >
              {poll.title}
            </Link>
            <span className="font-copy ml-2 text-sm text-muted-foreground">
              {/*
                Never "Brandon is waiting on you" to Brandon. You can perfectly well be waiting on
                your own poll — you have to answer it like everyone else — but being told so in
                the third person reads as a bug.
              */}
              {poll.createdById === viewerUserId || !poll.createdByName
                ? "you haven't answered yet"
                : `${poll.createdByName.split(" ")[0]} is waiting on you`}
            </span>
          </li>
        ))}
      </RuledList>
    </Section>
  );
}

type Board = Awaited<ReturnType<typeof getBoardView>>;

/**
 * Who's around today. A row of faces, read in about a second.
 *
 * The state is carried by the face itself rather than by a word beside it: a full-colour avatar is
 * here, a dimmed one is away, and a *dotted empty circle* is somebody who has not said. Nobody
 * reads a list of five names and five statuses every morning; everybody can see five faces.
 *
 * The dotted circle is the load-bearing one. It has to read as a hole where a person should be —
 * not as a fourth kind of person — because the whole board rests on the difference between
 * somebody who said no and somebody who said nothing.
 */
function Today({ board }: { board: Board }) {
  if (board.presence.length === 0) {
    return (
      <Section title="Today">
        <p className="font-copy text-base text-muted-foreground">
          No one has a profile yet. Run <code>pnpm db:seed</code>.
        </p>
      </Section>
    );
  }

  return (
    <Section title="Today">
      <ul className="flex flex-wrap gap-x-6 gap-y-4">
        {board.presence.map((row) => (
          <li
            key={row.member.profileId}
            className="flex w-20 flex-col items-center gap-1.5 text-center"
          >
            {row.state === null ? (
              <span
                className="flex size-11 shrink-0 items-center justify-center rounded-full border border-dashed border-border"
                aria-hidden
              />
            ) : (
              <PersonBadge
                name={row.member.name}
                size={44}
                // Dimmed rather than greyed: the face is still recognisable, which is what makes
                // "away" read as a state of a person rather than as a different person.
                className={row.state === "AWAY" ? "opacity-35" : undefined}
              />
            )}
            <span className="font-copy text-sm leading-tight">
              {row.member.name.split(" ")[0]}
            </span>
            {/* Two lines reserved: "here" is one and "nothing said" is two, and a row that
                changes height as people answer moves everything below it. */}
            <span className="flex min-h-[2.2em] items-start justify-center text-[0.625rem] uppercase leading-[1.1] tracking-wider text-muted-foreground">
              {row.state === "AROUND"
                ? "here"
                : row.state === "AWAY"
                  ? (row.note ?? "away")
                  : "nothing said"}
            </span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/**
 * The lede. For a family that no longer lives in one house, "when are we next all in one place"
 * is the question the whole board exists to answer, so it runs first and largest — set in the
 * headline serif the way a front page sets its top story.
 *
 * When it cannot say, it says *who it is waiting for*. The countdown still declines while anybody
 * is unsaid — silence is never a yes, here or anywhere else in this app — but it used to decline
 * in silence of its own, and a headline that reads "nothing on the calendar yet" every day is a
 * headline nobody reads. Naming them turns the board's one dead section into its one ask.
 */
function Gathering({
  board,
  viewerProfileId,
}: {
  board: Board;
  viewerProfileId: string | null;
}) {
  if (!board.gathering) {
    return (
      <Section title="All together">
        {board.unsaidToday.length > 0 ? (
          <>
            <p className="font-headline text-4xl leading-tight sm:text-5xl">
              Waiting on{" "}
              {joinNames(
                board.unsaidToday.map((member) =>
                  member.profileId === viewerProfileId
                    ? "you"
                    : member.name.split(" ")[0],
                ),
              )}
            </p>
            {/*
              No link: the fortnight it would have pointed at is on this page, just below. And the
              sentence stops promising a countdown it cannot deliver — saying your own days does
              not start it unless you were the last one left.
            */}
            <p className="font-copy mt-2 text-base text-muted-foreground">
              {board.unsaidToday.length === 1 &&
              board.unsaidToday[0].profileId === viewerProfileId
                ? "You're the last one — say your days below and it starts."
                : "Say your days below."}
            </p>
          </>
        ) : (
          /*
            Never "in the next year". `findNextGathering` scans a year and declines on any day
            nobody has spoken for, and the fortnight below is the only thing that writes days — so
            days fifteen onward are unsaid by construction, for everybody, always. Reporting a year
            of certainty from two weeks of data was the largest false sentence in the app, and it
            said "free", which is the reading of AROUND the model specifically forbids.
          */
          <p className="font-copy text-base leading-relaxed text-muted-foreground">
            No day in the next two weeks works for everyone.
          </p>
        )}
      </Section>
    );
  }

  const { date, inDays } = board.gathering;

  return (
    <Section title="All together">
      <p className="font-headline text-4xl leading-tight sm:text-5xl">
        {inDays === 0
          ? "Everyone's together today"
          : inDays === 1
            ? "Everyone's together tomorrow"
            : `${inDays} days until everyone's together`}
      </p>
      <p className="font-copy mt-2 text-base text-muted-foreground">
        {formatCalendarDate(date, "EEEE d MMMM")}
      </p>
    </Section>
  );
}

/**
 * The next fortnight — the board's resting state, and now the only place presence is written.
 *
 * It replaced a list of five names and five places, which answered "where is everyone right now"
 * and answered it "not recorded" almost every time. Fourteen columns answer the question the
 * family actually has: where the week overlaps, who has run out of days, which weekend is spoken
 * for.
 *
 * A filled circle is here, an outlined one is away, and an *empty dashed* one is unsaid — a gap in
 * the paper rather than a third kind of mark. That distinction is the whole reason the countdown
 * can be trusted, so it has to survive being drawn small.
 *
 * The editing lives in `Fortnight`, a client component, because the write path needs a mode and an
 * optimistic paint. Which rows may be written is decided here, on the server, from the same
 * `canEditProfile` every other write path uses.
 */
function TheFortnight({
  board,
  user,
}: {
  board: Board;
  user: { id: string; profileId: string | null; role: FamilyRole | null };
}) {
  if (board.grid.length === 0) {
    return (
      <Section title="The next two weeks">
        <p className="font-copy text-base text-muted-foreground">
          Nobody&rsquo;s set up yet.
        </p>
      </Section>
    );
  }

  const actor =
    user.profileId && user.role
      ? { id: user.id, profileId: user.profileId, role: user.role }
      : null;

  const rows: FortnightRow[] = board.grid.map((row) => ({
    profileId: row.member.profileId,
    name: row.member.name,
    cells: row.days,
    horizon: row.horizon,
    editable: actor ? canEditProfile(actor, row.member.profileId) : false,
  }));

  return (
    <Section title="The next two weeks">
      <Fortnight
        days={board.gridDays}
        rows={rows}
        viewerProfileId={user.profileId ?? ""}
      />
    </Section>
  );
}

/**
 * "Macy", "Macy and Tanner", "you, Macy and 2 more" — a sentence, not a list.
 *
 * "you" is hoisted to the front and the tail is truncated at two names, exactly as the ballot's
 * `list()` does it. Two reasons, and the second is the one that bites.
 *
 * The reader has to appear: the lede is the largest type on the board and it was reading "Waiting
 * on Brandon, Jill, Tanner, Addison and Macy" to Brandon, naming him in the third person in the
 * one place the app shouts.
 *
 * And an uncapped list *changes height as people answer* — five names wrap to three lines, three
 * names to two, one name to one — so every write shoved the whole page, including the strip your
 * thumb was on, up or down by forty points. A capped list is one or two lines whatever happens.
 */
function joinNames(names: string[]): string {
  const ordered = names.includes("you")
    ? ["you", ...names.filter((name) => name !== "you")]
    : names;
  if (ordered.length === 0) return "";
  if (ordered.length === 1) return ordered[0];
  if (ordered.length === 2) return `${ordered[0]} and ${ordered[1]}`;
  return `${ordered[0]}, ${ordered[1]} and ${ordered.length - 2} more`;
}

/**
 * Birthdays and one-off dates, and nothing else.
 *
 * This used to list arrivals and departures too, which is what made it unreadable: a weekend
 * everyone is home produced five near-identical lines saying what the grid above already showed at
 * a glance. What is left is the part the grid cannot show, so the section renders nothing at all
 * when there is none of it — an empty slot that appears every day is a slot people stop reading.
 */
function Agenda({ board }: { board: Board }) {
  if (board.agenda.length === 0) return null;

  return (
    <Section title={`Also in the next ${AGENDA_WINDOW_DAYS} days`}>
      <RuledList>
        {board.agenda.map((entry) => (
          <li
            key={agendaKey(entry)}
            className="flex items-baseline gap-4 py-2.5 first:pt-0 last:pb-0"
          >
            {/*
                A fixed-width date column, tabular figures, uppercase and letterspaced — the
                stand-first of a listings column. Fixed width is what lets the eye run down the
                dates rather than reading each line from the start.
              */}
            <span className="w-28 shrink-0 text-[0.6875rem] uppercase tracking-[0.14em] text-muted-foreground tabular-nums">
              {describeRelativeDay(entry.date, board.today) ??
                formatCalendarDate(entry.date)}
            </span>
            <AgendaLine entry={entry} board={board} />
          </li>
        ))}
      </RuledList>
    </Section>
  );
}

function AgendaLine({ entry, board }: { entry: AgendaEntry; board: Board }) {
  if (entry.kind === "event") {
    return (
      <span className="font-copy text-base">
        <span className="font-semibold">{entry.title}</span>
        {entry.note ? (
          <span className="text-muted-foreground"> {entry.note}</span>
        ) : null}
      </span>
    );
  }

  const name = board.membersByProfileId[entry.profileId]?.name ?? "Someone";

  return (
    <span className="font-copy text-base">
      <span className="font-semibold">{name}</span>
      <span className="text-muted-foreground"> turns {entry.turning}</span>
    </span>
  );
}

/**
 * Stable across renders and unique within a day. The date alone collides — a birthday and an
 * event can share one — and React would then reuse the wrong node when the list changes.
 */
function agendaKey(entry: AgendaEntry): string {
  return entry.kind === "event"
    ? `event:${entry.eventId}`
    : `${entry.kind}:${entry.profileId}:${entry.date}`;
}
