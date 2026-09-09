import Link from "next/link";
import {
  AGENDA_WINDOW_DAYS,
  getBoardView,
  getPollsAwaiting,
} from "@/lib/board/view";
import { cn } from "@/lib/utils";
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
      <Gathering board={board} />
      <Grid board={board} />
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
            className="flex w-14 flex-col items-center gap-1.5 text-center"
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
            <span className="text-[0.625rem] uppercase tracking-wider text-muted-foreground">
              {row.state === "AROUND"
                ? "here"
                : row.state === "AWAY"
                  ? (row.note ?? "away")
                  : "no word"}
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
function Gathering({ board }: { board: Board }) {
  if (!board.gathering) {
    return (
      <Section title="All together">
        {board.unsaidToday.length > 0 ? (
          <>
            <p className="font-headline text-4xl leading-tight sm:text-5xl">
              Waiting on {joinNames(board.unsaidToday.map((m) => m.name))}
            </p>
            <p className="font-copy mt-2 text-base text-muted-foreground">
              <Link
                href="/home/around"
                className="underline underline-offset-4"
              >
                Say which days you&rsquo;ll be around
              </Link>{" "}
              and the countdown starts.
            </p>
          </>
        ) : (
          <p className="font-copy text-base leading-relaxed text-muted-foreground">
            Nobody&rsquo;s free on the same day in the next year.{" "}
            <Link href="/home/around" className="underline underline-offset-4">
              Change that
            </Link>
            .
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
 * The next fortnight, as a grid. The board's resting state — glanced at, not read.
 *
 * This replaced a list of five names and five places, which answered "where is everyone right
 * now" and answered it "not recorded" almost every time. Fourteen columns answer the question the
 * family actually has: where the week overlaps, who has run out of days, which weekend is already
 * spoken for.
 *
 * A filled cell is around, an outlined one is away, and an *empty* one is unsaid — a gap in the
 * paper rather than a third kind of mark. That distinction is the whole reason the countdown can
 * be trusted, so it has to survive being drawn small.
 */
function Grid({ board }: { board: Board }) {
  if (board.grid.length === 0) {
    return (
      <Section title="The next two weeks">
        <p className="font-copy text-base text-muted-foreground">
          No one has a profile yet. Run <code>pnpm db:seed</code>.
        </p>
      </Section>
    );
  }

  return (
    <Section title="The next two weeks">
      <table className="w-full border-separate border-spacing-0">
        <thead>
          <tr>
            <th className="w-px" aria-label="Person" />
            {board.gridDays.map((day) => (
              <th
                key={day}
                scope="col"
                className="pb-2 text-center text-[0.5625rem] uppercase tracking-wider font-medium text-muted-foreground tabular-nums"
              >
                <span className="block">
                  {formatCalendarDate(day, "EEEEE")}
                </span>
                <span className="block opacity-70">
                  {formatCalendarDate(day, "d")}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {board.grid.map((row) => (
            <tr key={row.member.profileId}>
              <th
                scope="row"
                className="border-t border-border py-2 pr-3 text-left font-normal"
              >
                <span className="flex items-center gap-2">
                  <PersonBadge name={row.member.name} size={24} />
                  <span className="font-copy text-sm">
                    {row.member.name.split(" ")[0]}
                  </span>
                </span>
              </th>
              {row.days.map((state, index) => (
                <td
                  key={board.gridDays[index]}
                  className="border-t border-border px-0.5 py-2"
                >
                  <span
                    // `title` rather than a legend: five people learn three marks once, and a
                    // legend is furniture that stays on the page forever to be read never.
                    title={`${row.member.name.split(" ")[0]} — ${formatCalendarDate(board.gridDays[index], "EEE d MMM")}: ${state === "AROUND" ? "around" : state === "AWAY" ? "away" : "not said"}`}
                    className={cn(
                      // Circles, matching the faces above and the strip on the Around tab. A
                      // fortnight of squares read as a chart; a fortnight of discs reads as
                      // people.
                      "mx-auto block aspect-square w-full max-w-5 rounded-full border",
                      state === "AROUND" && "border-foreground bg-foreground",
                      state === "AWAY" && "border-foreground",
                      state === null && "border-dashed border-border",
                    )}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Section>
  );
}

/** "Macy", "Macy and Tanner", "Macy, Tanner and Addison" — a sentence, not a list. */
function joinNames(names: string[]): string {
  const firsts = names.map((name) => name.split(" ")[0]);
  if (firsts.length <= 1) return firsts[0] ?? "";
  return `${firsts.slice(0, -1).join(", ")} and ${firsts[firsts.length - 1]}`;
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
