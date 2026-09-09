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

export const metadata = { title: "An ask — Arbini Family" };

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

  const { poll, members, options, ranked } = view;
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
            {poll.status === "SETTLED" ? " · settled" : ""}
          </p>
          <ShareLink />
        </div>
      </div>

      {poll.status === "SETTLED" ? (
        <Answer options={options} members={members} />
      ) : (
        <Section title="The choices">
          <div className="space-y-6">
            {options.map((option) => (
              <OptionRow
                key={option.optionId}
                option={option}
                members={members}
                viewerProfileId={actor.profileId}
                pollId={poll.id}
                mayManage={mayManage}
                isBest={leader?.optionId === option.optionId}
              />
            ))}
          </div>
        </Section>
      )}

      {mayManage ? (
        <Section title="This ask">
          <div className="flex flex-wrap items-center gap-3">
            {poll.status === "SETTLED" ? (
              <ReopenButton pollId={poll.id} />
            ) : null}
            <DeletePollButton pollId={poll.id} />
            <Link
              href={`/polls/new?from=${poll.id}`}
              className="font-copy text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              Ask again
            </Link>
          </div>
        </Section>
      ) : null}

      <p className="font-copy text-sm text-muted-foreground">
        <Link href="/polls" className="underline underline-offset-4">
          Everything the family&rsquo;s been asked
        </Link>
      </p>
    </div>
  );
}

/**
 * A settled ask, which is a different screen rather than the ballot with its buttons removed.
 *
 * It was the latter, and that is what made it unreadable: a heading saying "The answer" over two
 * options given identical weight, each with a full five-person roster of dashes, and the winner
 * marked only by a hairline and four words of grey type on the far right. The rejected date got as
 * much of the page as the chosen one, and ten rows of "—" reported a fact about the *question*
 * long after it had stopped being asked.
 *
 * So: the answer leads, at the size the board's own lede uses. Anything that would have made
 * somebody hesitate sits directly under it. Who said what stays, because a family looks that up
 * later, but as a row of faces rather than a form. The options nobody chose collapse to one line —
 * they are why the answer is the answer, and that is all they are now.
 */
function Answer({
  options,
  members,
}: {
  options: OptionView[];
  members: FamilyMember[];
}) {
  const chosen = options.find((option) => option.isSettled);
  const rest = options.filter((option) => !option.isSettled);

  // Settling on an option that was since deleted leaves a poll marked settled with nothing to show
  // for it. Rare, and `Poll.settledOption` is SetNull precisely so it does not cascade the poll
  // away — so the page has to render something honest rather than crash.
  if (!chosen) {
    return (
      <Section title="The answer">
        <p className="font-copy text-base text-muted-foreground">
          The option the family chose has since been deleted.
        </p>
      </Section>
    );
  }

  const kinds = new Map<string, ReplyKind>();
  for (const id of chosen.tally.yesBy) kinds.set(id, "YES");
  for (const id of chosen.tally.maybeBy) kinds.set(id, "MAYBE");
  for (const id of chosen.tally.noBy) kinds.set(id, "NO");

  return (
    <Section title="The answer">
      <p className="font-headline text-4xl leading-tight sm:text-5xl">
        {describeOption(chosen)}
      </p>

      {/*
        The most useful sentence on a settled ask, and the one that was whispered: somebody has
        said they will not be there. It is spent in the accent because this is exactly what the
        accent is for — the few things worth looking for.
      */}
      {chosen.awayNotes.length > 0 ? (
        <p className="font-copy mt-2 text-base text-primary">
          {describeAway(chosen)}
        </p>
      ) : null}

      <p className="font-copy mt-2 text-base text-muted-foreground">
        {describeAnswer(chosen)}
      </p>

      {/*
        The same three marks the board's "Today" row uses, for the same reason: a face carries a
        state faster than a word does, and an unanswered person has to read as a gap rather than as
        a different kind of answer.
      */}
      <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-4">
        {members.map((member) => {
          const kind = kinds.get(member.profileId) ?? null;
          return (
            <li
              key={member.profileId}
              className="flex w-14 flex-col items-center gap-1.5 text-center"
            >
              {kind === null ? (
                <span
                  className="flex size-11 shrink-0 items-center justify-center rounded-full border border-dashed border-border"
                  aria-hidden
                />
              ) : (
                <PersonBadge
                  name={member.name}
                  size={44}
                  className={kind === "NO" ? "opacity-35" : undefined}
                />
              )}
              <span className="font-copy text-sm leading-tight">
                {firstName(member.name)}
              </span>
              <span className="text-[0.625rem] uppercase tracking-wider text-muted-foreground">
                {kind === null ? "no word" : LABELS[kind]}
              </span>
            </li>
          );
        })}
      </ul>

      {rest.length > 0 ? (
        <p className="font-copy mt-6 text-sm text-muted-foreground">
          Also asked about{" "}
          {rest.map((option) => describeOption(option)).join(", ")}.
        </p>
      ) : null}
    </Section>
  );
}

/** One option on an ask still being answered. A settled one is rendered by `Answer` instead. */
function OptionRow({
  option,
  members,
  viewerProfileId,
  pollId,
  mayManage,
  isBest,
}: {
  option: OptionView;
  members: FamilyMember[];
  viewerProfileId: string;
  pollId: string;
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
    <div className="border-t-2 border-foreground/15 pt-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="font-headline text-2xl">{describeOption(option)}</h3>
        <p className="font-copy text-sm text-muted-foreground">
          {option.tally.unanimous
            ? "Everyone said yes"
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
          {describeAway(option)}
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
              {isViewer ? (
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

      {mayManage ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <SettleButton
            pollId={pollId}
            optionId={option.optionId}
            label={`It's ${describeOption(option)}`}
            // Only when there is something to warn about. The two-press confirm is in
            // `SettleButton`; what counts as a problem is decided here, where the data is.
            warning={
              option.awayNotes.length > 0 ? describeAway(option) : undefined
            }
          />
          {isBest && !option.tally.unanimous ? (
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

/**
 * What the option says.
 *
 * The date is formatted here rather than written into the column at creation. Freezing "Sat 19
 * Sep" into the database would be a display format stored as data, which is the thing the whole of
 * `lib/dates.ts` exists to prevent — and it would mean an ask made last year rendering in last
 * year's format beside one made today.
 */
function describeOption(option: {
  label: string | null;
  onDate: string | null;
}): string {
  if (option.label !== null) return option.label;
  return formatCalendarDate(option.onDate!, "EEE d MMM");
}

/**
 * Who has said they will not be there, and why.
 *
 * The "why" is whatever that person typed on their own strip — "Vanguard", "work trip" — and it is
 * free text, not a place the app knows anything about. Nothing derives it and nothing compares it;
 * it is carried from the `Presence` row that covers the day, so it says what they meant it to say.
 */
function describeAway(option: OptionView): string {
  return option.awayNotes
    .map((entry) =>
      entry.note
        ? `${firstName(entry.member.name)}'s away — ${entry.note}`
        : `${firstName(entry.member.name)}'s away`,
    )
    .join(" · ");
}

/** What the answer got, in a sentence, rather than as a scoreboard. */
function describeAnswer(option: OptionView): string {
  const { yes, maybe, noBy, silentBy } = option.tally;
  const parts: string[] = [];
  if (yes > 0) parts.push(`${yes} yes`);
  if (maybe > 0) parts.push(`${maybe} maybe`);
  if (noBy.length > 0) parts.push(`${noBy.length} no`);
  if (parts.length === 0) return "Nobody answered this one.";
  const said = parts.join(", ");
  return silentBy.length > 0
    ? `${said} — and ${silentBy.length} never answered.`
    : said;
}

/**
 * Who is still to answer, or who cannot make it — named, never counted.
 *
 * "Waiting on Macy" is something somebody can act on; "3 of 5" is a scoreboard. Naming who said no
 * next to the away line above also keeps a blocker a *circumstance* — Addison is at Vanguard —
 * rather than a person to be talked out of it.
 */
function summarize(
  option: OptionView,
  nameOf: (profileId: string) => string,
): string {
  const { silentBy, noBy } = option.tally;
  if (silentBy.length > 0) return `Waiting on ${list(silentBy.map(nameOf))}`;
  if (noBy.length > 0) return `${list(noBy.map(nameOf))} said no`;
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
