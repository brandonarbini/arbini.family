import type { CalendarDateString, PresenceStateDto } from '@server/api/v1/dto';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Copy } from '@/components/section';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDayOfMonth, formatLongDay, formatWeekdayInitial } from '@/lib/dates';

/**
 * Saying where you'll be, in about five seconds.
 *
 * The native half of `app/home/around/strip.tsx`, and the same design constraint: this is the
 * screen the family opens weekly, so anything that takes a minute gets used once.
 *
 * Pick which of three things you are saying, tap the days, save. Days are tapped one at a time
 * rather than as a first-and-last span — a span is fewer taps in the best case and a puzzle in
 * every other one, and "Friday, Saturday and the Tuesday after" is an ordinary week a span cannot
 * express at all.
 *
 * No "I'm around for the next two weeks" button, here or on the web. One tap asserting fourteen
 * facts is thirteen the person never considered, and with everyone marked around by default the
 * board's countdown would fire every day — the same dead headline reached from the other side.
 */

export interface StripDay {
  date: CalendarDateString;
  state: PresenceStateDto | null;
  note: string | null;
}

/** The three things a day can be. `null` is unsaid, which is the absence of the other two. */
type Setting = PresenceStateDto | null;

export function Strip({
  name,
  days,
  isSelf,
  pending,
  onSubmit,
}: {
  /** Whose strip this is, for the copy. A parent fills these in for the kids. */
  name: string;
  days: StripDay[];
  /** Drives the pronouns: "I'll be there" on your own strip, "Macy will" on anybody else's. */
  isSelf: boolean;
  pending: boolean;
  onSubmit: (input: { state: Setting; days: CalendarDateString[]; note: string | null }) => void;
}) {
  const theme = useTheme();
  const [picked, setPicked] = useState<CalendarDateString[]>([]);
  const [setting, setSetting] = useState<Setting>('AROUND');
  const [note, setNote] = useState('');

  const first = name.split(' ')[0];

  function toggle(date: CalendarDateString) {
    setPicked((current) =>
      current.includes(date) ? current.filter((d) => d !== date) : [...current, date],
    );
  }

  function submit() {
    if (picked.length === 0) return;
    onSubmit({ state: setting, days: picked, note: note.trim() ? note.trim() : null });
    setPicked([]);
    setNote('');
  }

  return (
    <View>
      {/*
        The toggle sits above the calendar because it decides what a tap *means*, and a control
        that changes the meaning of the next thing you touch belongs before it. Picked days render
        in whatever it is set to, so the answer is visible before it is saved.
      */}
      <Toggle value={setting} onChange={setSetting} isSelf={isSelf} name={first} />

      {/* Seven to a row, so a column is a weekday and two rows are a fortnight. */}
      <View style={styles.grid}>
        {days.map((day) => (
          <Cell
            key={day.date}
            day={day}
            picked={picked.includes(day.date)}
            setting={setting}
            onPress={() => toggle(day.date)}
          />
        ))}
      </View>

      {picked.length === 0 ? (
        <Copy muted style={styles.hint}>
          Tap the days you want to set.
        </Copy>
      ) : (
        <View style={styles.panel}>
          {setting !== null ? (
            <TextInput
              value={note}
              onChangeText={setNote}
              maxLength={200}
              // Deliberately not an example. "Vanguard, work trip, back late" read as something
              // already filled in, which is the one thing a placeholder must never do.
              placeholder="Add a note"
              // Half-strength, so it reads as an invitation rather than as something already
              // filled in — which is what the old example text did.
              placeholderTextColor={theme.textSecondary + '80'}
              style={[styles.note, { color: theme.text, borderColor: theme.border }]}
            />
          ) : null}

          <View style={styles.actions}>
            <Action
              label={describeSave(setting, picked.length, isSelf, first)}
              filled
              disabled={pending}
              onPress={submit}
            />
            <Action label="Clear" quiet disabled={pending} onPress={() => setPicked([])} />
            {pending ? <ActivityIndicator style={styles.spinner} /> : null}
          </View>
        </View>
      )}
    </View>
  );
}

/**
 * Three states, one control.
 *
 * A segmented toggle rather than three submit buttons: the buttons made you choose the answer and
 * commit to it in the same press, so there was no moment where the screen showed what you were
 * about to say. Here the choice is a mode, the picked days redraw in it, and saving is separate.
 *
 * "Not saying" is a real option rather than a hidden reset. An unsaid day is the absence of a
 * statement, and taking one back has to be as reachable as making one.
 */
function Toggle({
  value,
  onChange,
  isSelf,
  name,
}: {
  value: Setting;
  onChange: (next: Setting) => void;
  isSelf: boolean;
  name: string;
}) {
  const theme = useTheme();
  const options: { setting: Setting; label: string }[] = [
    { setting: 'AROUND', label: isSelf ? "I'll be there" : `${name} will` },
    { setting: 'AWAY', label: isSelf ? "I won't" : `${name} won't` },
    { setting: null, label: 'Not saying' },
  ];

  return (
    <View style={styles.toggle} accessibilityRole="radiogroup">
      {options.map((option) => {
        const on = option.setting === value;
        return (
          <Pressable
            key={option.label}
            onPress={() => onChange(option.setting)}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            style={({ pressed }) => [
              styles.toggleOption,
              {
                borderColor: on ? theme.text : theme.border,
                backgroundColor: on ? theme.text : 'transparent',
                opacity: pressed ? 0.6 : 1,
              },
            ]}
          >
            {/* The same three marks the calendar uses, so the toggle reads as a key to it. */}
            <View
              style={[
                styles.swatch,
                {
                  borderColor: on ? theme.background : theme.text,
                  borderStyle: option.setting === null ? 'dashed' : 'solid',
                  backgroundColor:
                    option.setting === 'AROUND'
                      ? on
                        ? theme.background
                        : theme.text
                      : 'transparent',
                },
              ]}
            />
            <Text
              style={[styles.toggleLabel, { color: on ? theme.background : theme.textSecondary }]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * One day, as a circle.
 *
 * Three appearances for three facts, and the third is the one worth protecting: filled is around,
 * outlined is away, and *empty and dashed* is unsaid — a gap in the paper rather than a third kind
 * of mark. Drawing unsaid as anything positive would make the board's silence look like an answer.
 *
 * A picked day is drawn in whatever the toggle is set to, not in what it currently says, so the
 * calendar previews the change rather than describing the past.
 */
function Cell({
  day,
  picked,
  setting,
  onPress,
}: {
  day: StripDay;
  picked: boolean;
  setting: Setting;
  onPress: () => void;
}) {
  const theme = useTheme();
  const shown = picked ? setting : day.state;
  const filled = shown === 'AROUND';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: picked }}
      accessibilityLabel={`${formatLongDay(day.date)} — ${label(day.state)}`}
      style={({ pressed }) => [styles.cellWrap, { opacity: pressed ? 0.6 : 1 }]}
    >
      <Text style={[styles.cellWeekday, { color: theme.textSecondary }]}>
        {formatWeekdayInitial(day.date)}
      </Text>
      <View
        style={[
          styles.cell,
          {
            borderColor: picked ? theme.primary : shown === null ? theme.border : theme.text,
            borderWidth: picked ? 2 : 1,
            borderStyle: shown === null && !picked ? 'dashed' : 'solid',
            backgroundColor: filled ? theme.text : 'transparent',
          },
        ]}
      >
        <Text style={[styles.cellDay, { color: filled ? theme.background : theme.text }]}>
          {formatDayOfMonth(day.date)}
        </Text>
      </View>
    </Pressable>
  );
}

function Action({
  label,
  onPress,
  disabled,
  filled = false,
  quiet = false,
}: {
  label: string;
  onPress: () => void;
  disabled: boolean;
  filled?: boolean;
  quiet?: boolean;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.action,
        {
          borderColor: quiet ? 'transparent' : theme.text,
          backgroundColor: filled ? theme.text : 'transparent',
          opacity: disabled ? 0.4 : pressed ? 0.6 : 1,
        },
      ]}
    >
      <Text
        style={[
          styles.actionLabel,
          { color: filled ? theme.background : quiet ? theme.textSecondary : theme.text },
        ]}
      >
        {label.toUpperCase()}
      </Text>
    </Pressable>
  );
}

function label(state: PresenceStateDto | null): string {
  return state === 'AROUND'
    ? 'will be there'
    : state === 'AWAY'
      ? "won't be there"
      : 'nothing said';
}

/** Says what the button is about to do, in the number of days it is about to do it to. */
function describeSave(setting: Setting, count: number, isSelf: boolean, name: string): string {
  const days = count === 1 ? '1 day' : `${count} days`;
  if (setting === null) return `Clear ${days}`;
  const who = isSelf ? '' : ` for ${name}`;
  return setting === 'AROUND' ? `Save ${days} as there${who}` : `Save ${days} as away${who}`;
}

const CELL = 40;

const styles = StyleSheet.create({
  toggle: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  toggleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: Radius,
    paddingHorizontal: Spacing.two + Spacing.half,
    paddingVertical: Spacing.two,
  },
  swatch: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
  },
  toggleLabel: {
    fontFamily: Fonts.sans,
    fontSize: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  // Exactly a seventh of the row, so a column is a weekday and a fortnight is two clean rows.
  // `flexGrow` here is what produced the old 8-then-6 wrap: the cells grew past a seventh and the
  // eighth still fitted.
  cellWrap: {
    width: `${100 / 7}%`,
    alignItems: 'center',
    paddingVertical: Spacing.one,
  },
  cellWeekday: {
    fontFamily: Fonts.sans,
    fontSize: 9,
    letterSpacing: 1,
    marginBottom: Spacing.half,
  },
  cell: {
    width: CELL,
    height: CELL,
    borderRadius: CELL / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellDay: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    fontVariant: ['tabular-nums'],
  },
  hint: {
    marginTop: Spacing.three,
    fontSize: 15,
  },
  panel: {
    marginTop: Spacing.three,
    gap: Spacing.three,
  },
  note: {
    fontFamily: Fonts.serif,
    fontSize: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.half,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  action: {
    borderRadius: Radius,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.half,
  },
  actionLabel: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.4,
  },
  spinner: {
    marginLeft: Spacing.one,
  },
});
