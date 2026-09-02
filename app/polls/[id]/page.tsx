import { notFound } from "next/navigation";
import Link from "next/link";
import { AnswerButtons } from "@/app/polls/[id]/ballot";
import { type OptionView, getPollView } from "@/app/polls/[id]/data";
import {
  DeletePollButton,
  ReopenButton,
  SettleButton,
} from "@/app/polls/[id]/settle-controls";
import { ShareLink } from "@/app/polls/[id]/share-link";
import { PersonBadge } from "@/components/person-badge";
import { RuledList, Section } from "@/components/ui/section";
import type { ReplyKind } from "@/generated/prisma/enums";
import { requireProfile } from "@/lib/auth-helpers";
import type { FamilyMember } from "@/lib/board/data";
import { canManagePoll } from "@/lib/board/permissions";
import { formatCalendarDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

export const metadata = { title: "A poll — Arbini Family" };

export default async function PollPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // `requireProfile`, not `requireAuth`: answering is per-profile, and this page's whole purpose
  // is to be opened from a link somebody was sent, so it has to bounce through sign-in and back.
  const actor = await requireProfile(`/polls/${id}`);
  const view = await getPollView(id, actor.profileId);
  if (!view) notFound();

  const { poll, gatheringPlace, members, options, ranked } = view;
  const mayManage = canManagePoll(actor, poll.createdById);
  // A leader only when it actually leads: with nothing answered every option ties at zero, and
  // labelling the first one "best so far" would be the board inventing a preference nobody has
  // expressed yet.
  const leader =
    ranked[0] &&
    ranked[0].yes > 0 &&
    (!ranked[1] || ranked[1].yes < ranked[0].yes)
      ? ranked[0]
      : null;

  return (
    <div>
      <div className="mb-10">
        <h1 className="font-headline text-4xl">{poll.title}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <p className="font-copy text-base text-muted-foreground">
            {/*
              Naming who asked is not decoration. Anyone may start a poll, and a poll that never
              says who started it quietly reads as something the parents do.
            */}
            {poll.createdByName ? `${poll.createdByName} asked` : "Asked"}
            {/*
              Only when it is somewhere other than home. Printing "at Home" on every weekly dinner
              poll is a word that never varies, which is a word nobody reads.
            */}
            {gatheringPlace && !gatheringPlace.isHome
              ? ` · at ${gatheringPlace.name}`
              : ""}
            {poll.status === "SETTLED" ? " · settled" : ""}
          </p>
          <ShareLink />
        </div>
      </div>

      <Section
        title={poll.status === "SETTLED" ? "The date" : "Which days work?"}
      >
        <div className="space-y-6">
          {options.map((option) => (
            <OptionRow
              key={option.optionId}
              option={option}
              members={members}
              viewerProfileId={actor.profileId}
              pollId={poll.id}
              settled={poll.status === "SETTLED"}
              mayManage={mayManage}
              isBest={leader?.optionId === option.optionId}
            />
          ))}
        </div>
      </Section>

      {mayManage ? (
        <Section title="This poll">
          <div className="flex flex-wrap items-center gap-3">
            {poll.status === "SETTLED" ? (
              <ReopenButton pollId={poll.id} />
            ) : null}
            <DeletePollButton pollId={poll.id} />
            <Link
              href={`/polls/new?from=${poll.id}`}
              className="font-copy text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              Ask again next week
            </Link>
          </div>
        </Section>
      ) : null}

      <p className="font-copy text-sm text-muted-foreground">
        <Link href="/polls" className="underline underline-offset-4">
          All polls
        </Link>
      </p>
    </div>
  );
}

function OptionRow({
  option,
  members,
  viewerProfileId,
  pollId,
  settled,
  mayManage,
  isBest,
}: {
  option: OptionView;
  members: FamilyMember[];
  viewerProfileId: string;
  pollId: string;
  settled: boolean;
  mayManage: boolean;
  isBest: boolean;
}) {
  // "Waiting on you" rather than "Waiting on Brandon" when Brandon is the one reading it. The
  // whole line exists to prompt an action, and naming somebody in the third person to their face
  // reads as a status report about a stranger.
  const nameOf = (profileId: string) =>
    profileId === viewerProfileId
      ? "you"
      : firstName(
          members.find((member) => member.profileId === profileId)?.name ??
            "someone",
        );

  const kinds = new Map<string, ReplyKind>();
  for (const id of option.tally.yesBy) kinds.set(id, "YES");
  for (const id of option.tally.maybeBy) kinds.set(id, "MAYBE");
  for (const id of option.tally.noBy) kinds.set(id, "NO");

  return (
    <div
      className={cn(
        "border-t-2 pt-3",
        option.isSettled ? "border-success" : "border-foreground/15",
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="font-headline text-2xl">{describeRange(option)}</h3>
        <p className="font-copy text-sm text-muted-foreground">
          {option.isSettled
            ? "That's the one"
            : // Once a date is chosen the others are history, so they stop asking for anything.
              // Leaving "waiting on you" under a date the family has already moved past is a
              // prompt to do something that no longer needs doing.
              settled
              ? `${option.tally.yes} yes`
              : option.tally.everyoneCanMake
                ? "Everyone can make it"
                : summarize(option, nameOf)}
        </p>
      </div>

      {/*
        Context the family already has, surfaced where the decision is made. For four of the five
        this line is empty; for whoever is away at school it is the entire point, and it means
        nobody proposes a Thursday without seeing it.
      */}
      {option.awayNotes.length > 0 ? (
        <p className="font-copy mt-1 text-sm text-muted-foreground/80">
          {option.awayNotes
            .map(
              (note) =>
                `${firstName(note.member.name)}'s at ${note.place.name}`,
            )
            .join(" · ")}
        </p>
      ) : null}

      <RuledList className="mt-3">
        {members.map((member) => {
          const kind = kinds.get(member.profileId) ?? null;
          const isViewer = member.profileId === viewerProfileId;
          return (
            <li
              key={member.profileId}
              className="flex items-center gap-3 py-2 first:pt-0 last:pb-0"
            >
              <PersonBadge
                name={member.name}
                size={28}
                // Nobody who has not answered is dimmed rather than absent: silence is a gap in
                // the data, not a refusal, and the row has to show it as one.
                className={kind === null ? "opacity-35" : undefined}
              />
              <span
                className={cn(
                  "font-copy text-base",
                  kind === null && "text-muted-foreground",
                )}
              >
                {firstName(member.name)}
              </span>
              {isViewer && !settled ? (
                <div className="ml-auto w-full max-w-[15rem]">
                  <AnswerButtons
                    optionId={option.optionId}
                    profileId={member.profileId}
                    current={kind}
                  />
                </div>
              ) : (
                <span className="font-copy ml-auto text-sm text-muted-foreground">
                  {kind === null ? "—" : LABELS[kind]}
                </span>
              )}
            </li>
          );
        })}
      </RuledList>

      {mayManage && !settled ? (
        <div className="mt-3 flex items-center gap-3">
          <SettleButton
            pollId={pollId}
            optionId={option.optionId}
            label={`It's ${describeRange(option)}`}
          />
          {isBest && !option.tally.everyoneCanMake ? (
            <span className="font-copy text-xs text-muted-foreground">
              Best so far
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

const LABELS: Record<ReplyKind, string> = {
  YES: "Yes",
  MAYBE: "Maybe",
  NO: "Can't",
};

/** A single day reads as a day; a range reads as a range. Same row, two shapes. */
function describeRange(option: { startsOn: string; endsOn: string }): string {
  if (option.startsOn === option.endsOn) {
    return formatCalendarDate(option.startsOn, "EEE d MMM");
  }
  return `${formatCalendarDate(option.startsOn, "EEE d")}–${formatCalendarDate(option.endsOn, "EEE d MMM")}`;
}

/**
 * Who is still to answer, or who cannot make it — named, never counted.
 *
 * "Waiting on Macy" is something somebody can act on; "3 of 5" is a scoreboard. Naming who cannot
 * make a date next to the away line above also keeps a blocker a *circumstance* — Addison is at
 * Vanguard — rather than a person to be talked out of it.
 */
function summarize(
  option: OptionView,
  nameOf: (profileId: string) => string,
): string {
  const { silentBy, noBy } = option.tally;
  if (silentBy.length > 0) return `Waiting on ${list(silentBy.map(nameOf))}`;
  if (noBy.length > 0) return `${list(noBy.map(nameOf))} can't make it`;
  return `${option.tally.yes} yes, ${option.tally.maybe} maybe`;
}

/**
 * "Macy", "Macy and Tanner", "you, Macy and 2 more" — never a bare count.
 *
 * "you" is hoisted to the front. The list is truncated at two names, so leaving it in board order
 * would drop the reader into the "and 2 more" tail exactly when the line is about them.
 */
function list(names: string[]): string {
  const ordered = names.includes("you")
    ? ["you", ...names.filter((name) => name !== "you")]
    : names;
  if (ordered.length === 1) return ordered[0];
  if (ordered.length === 2) return `${ordered[0]} and ${ordered[1]}`;
  return `${ordered[0]}, ${ordered[1]} and ${ordered.length - 2} more`;
}

function firstName(name: string): string {
  return name.split(" ")[0];
}
