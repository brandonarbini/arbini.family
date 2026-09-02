import { PollForm } from "@/app/polls/new/poll-form";
import { requireProfile } from "@/lib/auth-helpers";
import { getPlaces, getPoll } from "@/lib/board/data";
import { addCalendarDays, todayInFamilyTz } from "@/lib/dates";

export const metadata = { title: "Start a poll — Arbini Family" };

/**
 * Starting a poll.
 *
 * No permission check beyond having a profile. Anyone in the family may ask — Macy wanting to
 * know who is around on Saturday is the same act as Brandon wanting to know, and a poll only the
 * parents can start is a poll that only gets started when a parent thinks of it.
 */
export default async function NewPollPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  await requireProfile("/polls/new");
  const { from } = await searchParams;
  const today = todayInFamilyTz();

  // "Ask again": last week's poll shifted forward seven days. The recurring question in a family
  // where somebody is away at school is the same question every week, and re-typing it every
  // Sunday is exactly the friction that ends the habit.
  const [places, previous] = await Promise.all([
    getPlaces(),
    from ? getPoll(from) : null,
  ]);
  const repeated = previous?.options
    .map((option) => addCalendarDays(option.startsOn, 7))
    // A shifted day that has already passed is dropped rather than offered.
    .filter((day) => day >= today);

  return (
    <div>
      <div className="mb-10">
        <h1 className="font-headline text-4xl">
          {previous ? "Ask again" : "Start a poll"}
        </h1>
        <p className="font-copy mt-2 text-base text-muted-foreground">
          {previous
            ? "Same question, next week. Change anything that should be different."
            : "Pick a few days and send everyone the link."}
        </p>
      </div>

      <PollForm
        today={today}
        places={places}
        defaultTitle={previous?.title}
        defaultPlaceId={previous?.placeId}
        defaultDays={repeated}
      />
    </div>
  );
}
