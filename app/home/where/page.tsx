import { getEditorData } from "@/app/home/where/data";
import { DeleteStayButton } from "@/app/home/where/delete-stay-button";
import { StayForm } from "@/app/home/where/stay-form";
import { PersonBadge } from "@/components/person-badge";
import { RuledList, Section } from "@/components/ui/section";
import { requireProfile } from "@/lib/auth-helpers";
import { formatCalendarDate } from "@/lib/dates";

export const metadata = { title: "Where I am — Arbini Family" };

export default async function WherePage() {
  const actor = await requireProfile("/home/where");
  const { places, editable, stayLists } = await getEditorData(actor);

  return (
    <div>
      <div className="mb-10">
        <h1 className="font-headline text-4xl">Where I am</h1>
        <p className="font-copy mt-2 text-base text-muted-foreground">
          A stay is a place and a stretch of days. The board works everything
          out from these.
        </p>
      </div>

      <Section title="Add a stay">
        {places.length === 0 ? (
          <p className="font-copy text-base text-muted-foreground">
            There are no places yet. Run <code>pnpm db:seed</code> to create
            Home.
          </p>
        ) : (
          <StayForm
            people={editable}
            places={places}
            defaultProfileId={actor.profileId}
          />
        )}
      </Section>

      {stayLists.map(({ member, stays }) => (
        <Section key={member.profileId} title={member.name}>
          {stays.length === 0 ? (
            <div className="flex items-center gap-3">
              <PersonBadge name={member.name} size={28} />
              <p className="font-copy text-base text-muted-foreground">
                Nothing recorded yet.
              </p>
            </div>
          ) : (
            <RuledList>
              {stays.map((stay) => {
                const place = places.find((p) => p.id === stay.placeId);
                return (
                  <li
                    key={stay.id}
                    className="flex items-center gap-4 py-3 first:pt-0 last:pb-0"
                  >
                    <PersonBadge name={member.name} size={28} />
                    <div className="min-w-0">
                      <p className="font-copy text-base font-semibold">
                        {place?.name ?? "Unknown place"}
                      </p>
                      <p className="font-copy text-base text-muted-foreground">
                        {formatCalendarDate(stay.startsOn)}
                        {stay.endsOn
                          ? ` – ${formatCalendarDate(stay.endsOn)}`
                          : " onwards"}
                        {stay.note ? ` · ${stay.note}` : ""}
                      </p>
                    </div>
                    <div className="ml-auto">
                      <DeleteStayButton stayId={stay.id} />
                    </div>
                  </li>
                );
              })}
            </RuledList>
          )}
        </Section>
      ))}
    </div>
  );
}
