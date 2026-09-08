import { DatePicker, Host } from '@expo/ui/swift-ui';
import type { PlaceDto, StayInputDto } from '@server/api/v1/dto';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput } from 'react-native';

import { Copy, RuledList, Section } from '@/components/section';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatLongDay } from '@/lib/dates';

/**
 * The stay editor, shared by "add" and "edit".
 *
 * The dates use SwiftUI's own `DatePicker` through `@expo/ui`. Everything else on this screen is
 * drawn in the app's newspaper language, and mixing the two is a deliberate trade: a date picker
 * is a *control*, not chrome, and a hand-drawn calendar would be worse in every way that matters
 * to somebody trying to record a trip on a phone. Place and person stay as ruled rows, because
 * those are short lists that read better as type.
 *
 * Validation is the server's. The form does not re-implement "the last day can't be before the
 * first" — it renders whatever `fieldErrors` comes back, which is why the rule can only ever be
 * stated once.
 */

/** `YYYY-MM-DD` from a Date the picker produced, read in local time — the picker's own frame. */
function toCalendarDate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** The inverse, at local noon so no timezone can round it onto an adjacent day. */
function fromCalendarDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

export interface StayFormValues {
  profileId: string;
  placeId: string;
  startsOn: string;
  endsOn: string | null;
  note: string | null;
}

export function StayForm({
  places,
  people,
  initial,
  saving,
  deleting,
  formError,
  fieldErrors,
  onSave,
  onDelete,
}: {
  places: PlaceDto[];
  /** Who this stay may belong to. One entry means there is no choice to offer. */
  people: { profileId: string; name: string }[];
  initial: StayFormValues;
  saving: boolean;
  deleting?: boolean;
  formError?: string | null;
  fieldErrors?: Record<string, string[]>;
  onSave: (input: StayInputDto) => void;
  onDelete?: () => void;
}) {
  const theme = useTheme();
  const [values, setValues] = useState<StayFormValues>(initial);
  const openEnded = values.endsOn === null;

  const fieldError = (name: string) => fieldErrors?.[name]?.[0];

  return (
    <>
      {people.length > 1 ? (
        <Section title="Who">
          <RuledList>
            {people.map((person) => (
              <ChoiceRow
                key={person.profileId}
                label={person.name}
                selected={person.profileId === values.profileId}
                onPress={() => setValues((v) => ({ ...v, profileId: person.profileId }))}
              />
            ))}
          </RuledList>
        </Section>
      ) : null}

      <Section title="Where">
        <RuledList>
          {places.map((place) => (
            <ChoiceRow
              key={place.id}
              label={place.name}
              selected={place.id === values.placeId}
              onPress={() => setValues((v) => ({ ...v, placeId: place.id }))}
            />
          ))}
        </RuledList>
        {fieldError('placeId') ? <FieldError>{fieldError('placeId')}</FieldError> : null}
      </Section>

      <Section title="First day">
        <Copy>{formatLongDay(values.startsOn)}</Copy>
        <Host matchContents>
          <DatePicker
            selection={fromCalendarDate(values.startsOn)}
            displayedComponents={['date']}
            onDateChange={(date) => setValues((v) => ({ ...v, startsOn: toCalendarDate(date) }))}
          />
        </Host>
        {fieldError('startsOn') ? <FieldError>{fieldError('startsOn')}</FieldError> : null}
      </Section>

      <Section title="Last day">
        <Pressable
          onPress={() =>
            setValues((v) => ({ ...v, endsOn: v.endsOn === null ? v.startsOn : null }))
          }
          style={styles.toggleRow}
        >
          <Copy style={styles.toggleLabel}>
            {openEnded ? 'Staying indefinitely' : formatLongDay(values.endsOn!)}
          </Copy>
          <Text style={[styles.toggleAction, { color: theme.primary }]}>
            {openEnded ? 'SET AN END' : 'MAKE IT OPEN'}
          </Text>
        </Pressable>

        {openEnded ? (
          <Copy muted style={styles.hint}>
            The board will show them here until another stay takes over.
          </Copy>
        ) : (
          <Host matchContents>
            <DatePicker
              selection={fromCalendarDate(values.endsOn!)}
              displayedComponents={['date']}
              onDateChange={(date) => setValues((v) => ({ ...v, endsOn: toCalendarDate(date) }))}
            />
          </Host>
        )}
        {fieldError('endsOn') ? <FieldError>{fieldError('endsOn')}</FieldError> : null}
      </Section>

      <Section title="Note">
        <TextInput
          value={values.note ?? ''}
          onChangeText={(text) =>
            setValues((v) => ({ ...v, note: text.trim() === '' ? null : text }))
          }
          placeholder="Optional — “work trip”, “with the Hansens”"
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, { color: theme.text, borderColor: theme.border }]}
        />
        {fieldError('note') ? <FieldError>{fieldError('note')}</FieldError> : null}
      </Section>

      {formError ? (
        <Copy style={[styles.formError, { color: theme.destructive }]}>{formError}</Copy>
      ) : null}

      <Pressable
        onPress={() => onSave(values)}
        disabled={saving}
        style={({ pressed }) => [
          styles.save,
          { backgroundColor: theme.text, opacity: saving ? 0.4 : pressed ? 0.8 : 1 },
        ]}
      >
        {saving ? (
          <ActivityIndicator color={theme.background} />
        ) : (
          <Text style={[styles.saveLabel, { color: theme.background }]}>SAVE</Text>
        )}
      </Pressable>

      {onDelete ? (
        <Pressable onPress={onDelete} disabled={deleting} style={styles.delete}>
          {deleting ? (
            <ActivityIndicator color={theme.destructive} />
          ) : (
            <Text style={[styles.deleteLabel, { color: theme.destructive }]}>Delete this stay</Text>
          )}
        </Pressable>
      ) : null}
    </>
  );
}

function ChoiceRow({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.choice, { opacity: pressed ? 0.6 : 1 }]}
    >
      <Copy style={selected ? styles.choiceSelected : undefined}>{label}</Copy>
      {selected ? <Text style={[styles.tick, { color: theme.primary }]}>●</Text> : null}
    </Pressable>
  );
}

function FieldError({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  return <Copy style={[styles.fieldError, { color: theme.destructive }]}>{children}</Copy>;
}

const styles = StyleSheet.create({
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  choiceSelected: {
    fontWeight: '600',
  },
  tick: {
    fontSize: 12,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  toggleLabel: {
    flexShrink: 1,
  },
  toggleAction: {
    fontFamily: Fonts.sans,
    fontSize: 10,
    letterSpacing: 1.4,
  },
  hint: {
    marginTop: Spacing.two,
    fontSize: 14,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontFamily: Fonts.serif,
    fontSize: 17,
  },
  fieldError: {
    marginTop: Spacing.two,
    fontSize: 14,
  },
  formError: {
    marginBottom: Spacing.three,
    fontSize: 15,
  },
  save: {
    borderRadius: Radius,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  saveLabel: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.8,
  },
  delete: {
    marginTop: Spacing.four,
    alignItems: 'center',
  },
  deleteLabel: {
    fontFamily: Fonts.sans,
    fontSize: 15,
  },
});
