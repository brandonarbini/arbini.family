"use client";

import { useActionState, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { saveStay } from "@/app/home/where/actions";
import type { ActionResult } from "@/app/home/where/validations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FamilyMember, Place } from "@/lib/board/data";
import { todayInFamilyTz } from "@/lib/dates";

/**
 * Add or edit a stay.
 *
 * `useActionState` over a native `<form action>` rather than a fetch: the form still submits with
 * JavaScript unavailable, and the pending state comes from React instead of a `useState` that has
 * to be reset on every exit path.
 */
export function StayForm({
  people,
  places,
  defaultProfileId,
}: {
  people: FamilyMember[];
  places: Place[];
  defaultProfileId: string;
}) {
  const [state, formAction, pending] = useActionState<
    ActionResult | null,
    FormData
  >(saveStay, null);

  // Remounts the form on success, which is what clears the fields — an uncontrolled form keeps
  // whatever the user typed otherwise, and the next entry starts pre-filled with the last trip.
  const [generation, setGeneration] = useState(0);
  const [lastHandled, setLastHandled] = useState<ActionResult | null>(null);
  if (state?.ok && state !== lastHandled) {
    setLastHandled(state);
    setGeneration((value) => value + 1);
  }

  const fieldError = (name: string) =>
    state?.ok === false && state.fieldErrors?.[name]?.[0];

  return (
    <form key={generation} action={formAction} className="space-y-4">
      {people.length > 1 ? (
        <div className="space-y-1.5">
          <Label htmlFor="profileId">Who</Label>
          <select
            id="profileId"
            name="profileId"
            defaultValue={defaultProfileId}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {people.map((person) => (
              <option key={person.profileId} value={person.profileId}>
                {person.name}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <input type="hidden" name="profileId" value={defaultProfileId} />
      )}

      <div className="space-y-1.5">
        <Label htmlFor="placeId">Where</Label>
        <select
          id="placeId"
          name="placeId"
          required
          defaultValue={places[0]?.id ?? ""}
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {places.map((place) => (
            <option key={place.id} value={place.id}>
              {place.name}
            </option>
          ))}
        </select>
        <FieldError message={fieldError("placeId")} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="startsOn">First day</Label>
          <Input
            id="startsOn"
            name="startsOn"
            type="date"
            required
            defaultValue={todayInFamilyTz()}
            aria-invalid={Boolean(fieldError("startsOn"))}
          />
          <FieldError message={fieldError("startsOn")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="endsOn">Last day</Label>
          <Input
            id="endsOn"
            name="endsOn"
            type="date"
            aria-invalid={Boolean(fieldError("endsOn"))}
          />
          <p className="text-xs text-muted-foreground">
            Leave blank if you&rsquo;re staying put.
          </p>
          <FieldError message={fieldError("endsOn")} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="note">Note</Label>
        <Input
          id="note"
          name="note"
          maxLength={200}
          placeholder="Optional — flight number, who's driving"
          aria-invalid={Boolean(fieldError("note"))}
        />
        <FieldError message={fieldError("note")} />
      </div>

      {state?.ok === false && state.formError ? (
        <p role="alert" className="text-sm text-destructive">
          {state.formError}
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? (
          <>
            <Loader2 className="animate-spin" aria-hidden />
            Saving
          </>
        ) : (
          <>
            <Plus aria-hidden />
            Add
          </>
        )}
      </Button>
    </form>
  );
}

function FieldError({ message }: { message: string | false | undefined }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-sm text-destructive">
      {message}
    </p>
  );
}
