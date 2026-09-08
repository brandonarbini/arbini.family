import type { StayInputDto } from '@server/api/v1/dto';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';

import { Page } from '@/components/page';
import { Copy, Section } from '@/components/section';
import { StayForm } from '@/components/stay-form';
import { ApiError } from '@/lib/api';
import { useSaveStay, useWhere } from '@/lib/queries';

/** Record a new stay. `profileId` says whose list the button was under. */
export default function NewStayScreen() {
  const { profileId } = useLocalSearchParams<{ profileId: string }>();
  const router = useRouter();
  const { data } = useWhere();
  const save = useSaveStay();
  const [failure, setFailure] = useState<ApiError | null>(null);

  if (!data) return <Page dateline="Loading">{null}</Page>;

  const people = data.lists.map((list) => ({ profileId: list.profileId, name: list.name }));
  const today = data.today;

  function onSave(input: StayInputDto) {
    setFailure(null);
    save.mutate(
      { input },
      {
        onSuccess: () => router.back(),
        onError: (error) => setFailure(error instanceof ApiError ? error : null),
      },
    );
  }

  return (
    <Page dateline="Add a stay">
      {data.places.length === 0 ? (
        <Section title="Nowhere to go">
          <Copy muted>No places are set up yet. Add one on the website first.</Copy>
        </Section>
      ) : (
        <StayForm
          places={data.places}
          people={people}
          initial={{
            profileId: profileId ?? people[0]?.profileId ?? '',
            placeId: data.places[0].id,
            startsOn: today,
            endsOn: null,
            note: null,
          }}
          saving={save.isPending}
          formError={failure && !failure.fieldErrors ? failure.message : null}
          fieldErrors={failure?.fieldErrors}
          onSave={onSave}
        />
      )}
    </Page>
  );
}
