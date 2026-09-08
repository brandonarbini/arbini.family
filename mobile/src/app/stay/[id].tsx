import type { StayInputDto } from '@server/api/v1/dto';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { Page } from '@/components/page';
import { Copy, Section } from '@/components/section';
import { StayForm } from '@/components/stay-form';
import { ApiError } from '@/lib/api';
import { useDeleteStay, useSaveStay, useWhere } from '@/lib/queries';

/** Change or remove one stay. */
export default function EditStayScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data } = useWhere();
  const save = useSaveStay();
  const remove = useDeleteStay();
  const [failure, setFailure] = useState<ApiError | null>(null);

  if (!data) return <Page dateline="Loading">{null}</Page>;

  const found = data.lists
    .flatMap((list) => list.stays.map((stay) => ({ stay, list })))
    .find((entry) => entry.stay.id === id);

  if (!found) {
    // Reachable by going back to a screen whose stay was deleted elsewhere, which is a fact rather
    // than an error — so it reads as one.
    return (
      <Page dateline="Gone">
        <Section title="That stay">
          <Copy muted>It is no longer there. Somebody may have removed it.</Copy>
        </Section>
      </Page>
    );
  }

  const { stay } = found;
  const people = data.lists.map((list) => ({ profileId: list.profileId, name: list.name }));

  function onSave(input: StayInputDto) {
    setFailure(null);
    save.mutate(
      { stayId: id, input },
      {
        onSuccess: () => router.back(),
        onError: (error) => setFailure(error instanceof ApiError ? error : null),
      },
    );
  }

  function onDelete() {
    Alert.alert('Delete this stay?', 'It will disappear from the board.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          remove.mutate(id, {
            onSuccess: () => router.back(),
            onError: (error) => setFailure(error instanceof ApiError ? error : null),
          }),
      },
    ]);
  }

  return (
    <Page dateline="Edit a stay">
      <StayForm
        places={data.places}
        people={people}
        initial={{
          profileId: stay.profileId,
          placeId: stay.place.id,
          startsOn: stay.startsOn,
          endsOn: stay.endsOn,
          note: stay.note,
        }}
        saving={save.isPending}
        deleting={remove.isPending}
        formError={failure && !failure.fieldErrors ? failure.message : null}
        fieldErrors={failure?.fieldErrors}
        onSave={onSave}
        onDelete={onDelete}
      />
    </Page>
  );
}
