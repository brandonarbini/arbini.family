import { PollForm } from "@/app/polls/new/poll-form";
import { requireProfile } from "@/lib/auth-helpers";
import { getPoll } from "@/lib/board/data";
import { addCalendarDays, todayInFamilyTz } from "@/lib/dates";

export const metadata = { title: "Ask the family — Arbini Family" };

/**
 * Asking the family something.
 *
 * No permission check beyond having a profile. Anyone in the family may ask — Macy wanting to know
 * what is for dinner is the same act as Brandon wanting to know, and an ask only the parents can
 * start is an ask that only gets started when a parent thinks of it.
 */
export default async function NewPollPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  await requireProfile("/polls/new");
  const { from } = await searchParams;
  const today = todayInFamilyTz();

  // "Ask again": last week's question, carried forward. The recurring ask in a family is the same
  // ask every week, and re-typing it every Sunday is exactly the friction that ends the habit.
  //
  // A dated option shifts seven days, because "which weekend?" means the *next* weekend. A choice
  // does not: "tacos" a week later is still tacos, and shifting it would be nonsense.
  const previous = from ? await getPoll(from) : null;
  const repeated = previous?.options
    .map((option) => ({
      label: option.label,
      onDate: option.onDate ? addCalendarDays(option.onDate, 7) : null,
    }))
    // A shifted date that has already passed is dropped rather than offered.
    .filter((option) => option.onDate === null || option.onDate >= today);

  return (
    <div>
      <div className="mb-10">
        <h1 className="font-headline text-4xl">
          {previous ? "Ask again" : "Ask the family"}
        </h1>
        <p className="font-copy mt-2 text-base text-muted-foreground">
          {previous
            ? "Same question, next week. Change anything that should be different."
            : "A question, a few answers to choose from, and a link to send round."}
        </p>
      </div>

      <PollForm
        today={today}
        defaultTitle={previous?.title}
        defaultOptions={repeated}
      />
    </div>
  );
}
