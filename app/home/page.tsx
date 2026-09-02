import Link from "next/link";
import { AGENDA_WINDOW_DAYS, getBoardView } from "@/app/home/data";
import { PersonBadge } from "@/components/person-badge";
import { RuledList, Section } from "@/components/ui/section";
import { requireAuth } from "@/lib/auth-helpers";
import type { AgendaEntry } from "@/lib/board/agenda";
import {
  describeRelativeDay,
  formatCalendarDate,
  todayInFamilyTz,
} from "@/lib/dates";

export const metadata = { title: "The board — Arbini Family" };

export default async function BoardPage() {
  await requireAuth();
  // Read here rather than inside the data layer: the cached queries key on their arguments, so
  // the clock has to be consulted outside them or "today" would be frozen into a cache entry.
  const board = await getBoardView(todayInFamilyTz());

  return (
    <div>
      <Gathering board={board} />
      <Presence board={board} />
      <Agenda board={board} />
    </div>
  );
}

type Board = Awaited<ReturnType<typeof getBoardView>>;

/**
 * The lede. For a family that no longer lives in one house, "when are we next all in the same
 * room" is the question the whole board exists to answer, so it runs first and largest — set in
 * the headline serif the way a front page sets its top story.
 */
function Gathering({ board }: { board: Board }) {
  if (!board.gathering) {
    return (
      <Section title="All together">
        <p className="font-copy text-base leading-relaxed text-muted-foreground">
          Nothing on the calendar yet where everyone is in the same place.{" "}
          <Link href="/home/where" className="underline underline-offset-4">
            Add where you&rsquo;ll be
          </Link>{" "}
          and it&rsquo;ll show up here.
        </p>
      </Section>
    );
  }

  const { date, place, inDays } = board.gathering;

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
        {formatCalendarDate(date, "EEEE d MMMM")} at {place.name}
      </p>
    </Section>
  );
}

/** Where each person is right now. The board's resting state — glanced at, not read. */
function Presence({ board }: { board: Board }) {
  return (
    <Section title="Right now">
      {board.presence.length === 0 ? (
        <p className="font-copy text-base text-muted-foreground">
          No one has a profile yet. Run <code>pnpm db:seed</code>.
        </p>
      ) : (
        <RuledList>
          {board.presence.map(({ member, place, until }) => (
            <li
              key={member.profileId}
              className="flex items-center gap-4 py-3 first:pt-0 last:pb-0"
            >
              <PersonBadge name={member.name} size={40} />
              <span className="font-copy text-lg">{member.name}</span>
              <span className="font-copy ml-auto text-right text-base text-muted-foreground">
                {place ? (
                  <>
                    {place.name}
                    {until ? (
                      <span className="text-muted-foreground/70">
                        {" "}
                        &middot; until {formatCalendarDate(until, "d MMM")}
                      </span>
                    ) : null}
                  </>
                ) : (
                  // Distinguished from "at home" on purpose: an unknown location is a gap in the
                  // data, and quietly defaulting it to home would make the gathering countdown
                  // confidently wrong.
                  <span className="italic">not recorded</span>
                )}
              </span>
            </li>
          ))}
        </RuledList>
      )}
    </Section>
  );
}

function Agenda({ board }: { board: Board }) {
  return (
    <Section title={`Next ${AGENDA_WINDOW_DAYS} days`}>
      {board.agenda.length === 0 ? (
        <p className="font-copy text-base text-muted-foreground">
          Nothing coming up.{" "}
          <Link href="/home/where" className="underline underline-offset-4">
            Add a trip
          </Link>
          .
        </p>
      ) : (
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
      )}
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

  if (entry.kind === "birthday") {
    return (
      <span className="font-copy text-base">
        <span className="font-semibold">{name}</span>
        <span className="text-muted-foreground"> turns {entry.turning}</span>
      </span>
    );
  }

  const place = board.placesById[entry.placeId]?.name ?? "somewhere";
  return (
    <span className="font-copy text-base">
      <span className="font-semibold">{name}</span>
      <span className="text-muted-foreground">
        {" "}
        {entry.kind === "arrival" ? "arrives at" : "leaves"} {place}
      </span>
    </span>
  );
}

/**
 * Stable across renders and unique within a day. The date alone collides — a birthday and an
 * arrival can share one — and React would then reuse the wrong node when the list changes.
 */
function agendaKey(entry: AgendaEntry): string {
  return entry.kind === "event"
    ? `event:${entry.eventId}`
    : `${entry.kind}:${entry.profileId}:${entry.date}`;
}
