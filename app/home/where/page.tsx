import { getEditorData } from "@/app/home/where/data";
import { DeleteStayButton } from "@/app/home/where/delete-stay-button";
import { StayForm } from "@/app/home/where/stay-form";
import { PersonBadge } from "@/components/person-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireProfile } from "@/lib/auth-helpers";
import { formatCalendarDate } from "@/lib/dates";

export const metadata = { title: "Where I am — Arbini Family" };

export default async function WherePage() {
  const actor = await requireProfile("/home/where");
  const { places, editable, stayLists } = await getEditorData(actor);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl">Where I am</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A stay is a place and a stretch of days. The board works everything
          out from these.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add a stay</CardTitle>
        </CardHeader>
        <CardContent>
          {places.length === 0 ? (
            <p className="text-sm text-muted-foreground">
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
        </CardContent>
      </Card>

      {stayLists.map(({ member, stays }) => (
        <Card key={member.profileId}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PersonBadge
                name={member.name}
                color={member.color}
                className="size-5 text-[10px]"
              />
              {member.name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stays.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing recorded yet.
              </p>
            ) : (
              <ul className="divide-y">
                {stays.map((stay) => {
                  const place = places.find((p) => p.id === stay.placeId);
                  return (
                    <li
                      key={stay.id}
                      className="flex items-center gap-3 py-2 first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          {place?.name ?? "Unknown place"}
                        </p>
                        <p className="text-sm text-muted-foreground">
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
              </ul>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
