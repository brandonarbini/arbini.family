import Link from "next/link";
import { CalendarDays, Home, MapPin, PartyPopper, Plane } from "lucide-react";
import { AGENDA_WINDOW_DAYS, getBoardView } from "@/app/home/data";
import { PersonBadge } from "@/components/person-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <div className="space-y-6">
      <GatheringCard board={board} />
      <PresenceCard board={board} />
      <AgendaCard board={board} />
    </div>
  );
}

type Board = Awaited<ReturnType<typeof getBoardView>>;

/**
 * The headline. For a family that no longer lives in one house, "when are we next all in the same
 * room" is the question the whole board exists to answer, so it goes first and gets the most
 * space.
 */
function GatheringCard({ board }: { board: Board }) {
  if (!board.gathering) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>All together</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Nothing on the calendar yet where everyone is in the same place.{" "}
            <Link href="/home/where" className="underline underline-offset-4">
              Add where you&rsquo;ll be
            </Link>{" "}
            and it&rsquo;ll show up here.
          </p>
        </CardContent>
      </Card>
    );
  }

  const { date, place, inDays } = board.gathering;

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PartyPopper className="size-4 text-primary" aria-hidden />
          All together
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="font-display text-3xl">
          {inDays === 0
            ? "Everyone's together today"
            : inDays === 1
              ? "Everyone's together tomorrow"
              : `${inDays} days until everyone's together`}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {formatCalendarDate(date, "EEEE d MMMM")} at {place.name}
        </p>
      </CardContent>
    </Card>
  );
}

/** Where each person is right now. The board's resting state — glanced at, not read. */
function PresenceCard({ board }: { board: Board }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Right now</CardTitle>
      </CardHeader>
      <CardContent>
        {board.presence.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No one has a profile yet. Run <code>pnpm db:seed</code>.
          </p>
        ) : (
          <ul className="divide-y">
            {board.presence.map(({ member, place, until }) => (
              <li
                key={member.profileId}
                className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
              >
                <PersonBadge name={member.name} />
                <span className="font-medium">{member.name}</span>
                <span className="ml-auto flex items-center gap-1.5 text-sm text-muted-foreground">
                  {place ? (
                    <>
                      {place.isHome ? (
                        <Home className="size-3.5" aria-hidden />
                      ) : (
                        <MapPin className="size-3.5" aria-hidden />
                      )}
                      {place.name}
                      {until ? (
                        <span className="text-muted-foreground/70">
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
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function AgendaCard({ board }: { board: Board }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Next {AGENDA_WINDOW_DAYS} days</CardTitle>
      </CardHeader>
      <CardContent>
        {board.agenda.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing coming up.{" "}
            <Link href="/home/where" className="underline underline-offset-4">
              Add a trip
            </Link>
            .
          </p>
        ) : (
          <ul className="space-y-2.5">
            {board.agenda.map((entry) => (
              <li key={agendaKey(entry)} className="flex items-baseline gap-3">
                <span className="w-24 shrink-0 text-sm tabular-nums text-muted-foreground">
                  {describeRelativeDay(entry.date, board.today) ??
                    formatCalendarDate(entry.date)}
                </span>
                <AgendaLine entry={entry} board={board} />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function AgendaLine({ entry, board }: { entry: AgendaEntry; board: Board }) {
  if (entry.kind === "event") {
    return (
      <span className="flex items-baseline gap-1.5 text-sm">
        <CalendarDays className="size-3.5 self-center" aria-hidden />
        <span className="font-medium">{entry.title}</span>
        {entry.note ? (
          <span className="text-muted-foreground">{entry.note}</span>
        ) : null}
      </span>
    );
  }

  const name = board.membersByProfileId[entry.profileId]?.name ?? "Someone";

  if (entry.kind === "birthday") {
    return (
      <span className="flex items-baseline gap-1.5 text-sm">
        <PartyPopper className="size-3.5 self-center" aria-hidden />
        <span className="font-medium">{name}</span>
        <span className="text-muted-foreground">turns {entry.turning}</span>
      </span>
    );
  }

  const place = board.placesById[entry.placeId]?.name ?? "somewhere";
  return (
    <span className="flex items-baseline gap-1.5 text-sm">
      <Plane className="size-3.5 self-center" aria-hidden />
      <span className="font-medium">{name}</span>
      <span className="text-muted-foreground">
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
