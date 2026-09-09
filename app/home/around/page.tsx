import { Strip } from "@/app/home/around/strip";
import { PersonBadge } from "@/components/person-badge";
import { Section } from "@/components/ui/section";
import { requireProfile } from "@/lib/auth-helpers";
import { STRIP_DAYS, getStripData } from "@/lib/board/editor";
import { formatCalendarDate, todayInFamilyTz } from "@/lib/dates";
import { type Horizon, projectDays } from "@/lib/presence/derive";

export const metadata = { title: "Around — Arbini Family" };

export default async function AroundPage() {
  const actor = await requireProfile("/home/around");
  const today = todayInFamilyTz();
  const { strips } = await getStripData(actor, today);

  // A kid gets exactly one strip: their own. A parent gets everybody's, which is a power worth
  // naming rather than leaving to be discovered — before this line, the page simply showed four
  // extra calendars with no explanation of why they were editable or who else could see them.
  const others = strips.filter(
    (strip) => strip.member.profileId !== actor.profileId,
  );

  return (
    <div>
      <div className="mb-10">
        <h1 className="font-headline text-4xl">Around</h1>
        <p className="font-copy mt-2 text-base text-muted-foreground">
          Which days you&rsquo;ll be with the family, and which you won&rsquo;t.
          The board works everything out from these.
        </p>
        {others.length > 0 ? (
          <p className="font-copy mt-3 text-base text-muted-foreground">
            You can fill these in for anyone, because you&rsquo;re a parent.{" "}
            {joinNames(others.map((strip) => strip.member.name))}{" "}
            {others.length === 1 ? "sees" : "see"} only their own.
          </p>
        ) : null}
      </div>

      {strips.map((strip) => {
        const isSelf = strip.member.profileId === actor.profileId;
        // Resolved per day from the runs rather than read off a row per day: the storage is a
        // range, and the strip is a projection of it. That is what lets "at school until told
        // otherwise" stay one row instead of a hundred that something has to keep extending.
        const days = projectDays(
          strip.runs,
          strip.member.profileId,
          today,
          STRIP_DAYS,
        );

        return (
          <Section
            key={strip.member.profileId}
            title={isSelf ? `${strip.member.name} — you` : strip.member.name}
          >
            <div className="mb-4 flex items-center gap-3">
              <PersonBadge name={strip.member.name} size={28} />
              <p className="font-copy text-base text-muted-foreground">
                {describeHorizon(
                  strip.horizon,
                  isSelf,
                  strip.member.name.split(" ")[0],
                )}
              </p>
            </div>
            <Strip
              profileId={strip.member.profileId}
              name={strip.member.name}
              days={days}
              isSelf={isSelf}
            />
          </Section>
        );
      })}
    </div>
  );
}

/**
 * How far ahead this person has said anything.
 *
 * The one line on the page that is an ask rather than a control, so it names the day rather than
 * counting them: "said through Sunday" is a fact you can check against your own week, where "said
 * for 4 more days" is arithmetic you have to do before you can act on it.
 */
function describeHorizon(
  horizon: Horizon,
  isSelf: boolean,
  name: string,
): string {
  const who = isSelf ? "You've" : `${name} has`;
  switch (horizon.kind) {
    case "open":
      return `${who} said, until further notice.`;
    case "unsaid":
      return `${isSelf ? "You haven't" : `${name} hasn't`} said anything about today yet.`;
    case "through":
      return `${who} said through ${formatCalendarDate(horizon.date, "EEEE d MMMM")}.`;
  }
}

/** "Macy", "Macy and Tanner", "Macy, Tanner and Addison" — a sentence, not a list. */
function joinNames(names: string[]): string {
  const firsts = names.map((name) => name.split(" ")[0]);
  if (firsts.length <= 1) return firsts[0] ?? "";
  return `${firsts.slice(0, -1).join(", ")} and ${firsts[firsts.length - 1]}`;
}
