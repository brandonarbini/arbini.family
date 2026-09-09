import type {
  AgendaEntryDto,
  BoardDto,
  GridCellDto,
  GridRowDto,
  PresenceStateDto,
} from '@server/api/v1/dto';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';

import { LoadFailure } from '@/components/load-failure';
import { Page } from '@/components/page';
import { PersonBadge } from '@/components/person-badge';
import { Copy, DateStamp, RuledList, Section } from '@/components/section';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/lib/api';
import {
  describeRelativeDay,
  formatDateline,
  formatDayOfMonth,
  formatLongDay,
  formatWeekdayInitial,
  formatWeekdayShort,
} from '@/lib/dates';
import { useBoard, useSetPresence } from '@/lib/queries';

/**
 * The board, in the same order the web sets it: what is being asked of you, then the lede, then
 * the resting state, then the listings.
 */
export default function BoardScreen() {
  const { data, isPending, error, refetch, isRefetching } = useBoard();

  if (isPending) return <Page dateline="Loading">{null}</Page>;
  if (error) return <LoadFailure title="The board" error={error} onRetry={refetch} />;

  return (
    <Page
      dateline={formatDateline(data.today)}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
    >
      <YourTurn board={data} />
      <Today board={data} />
      <Gathering board={data} />
      <Fortnight board={data} />
      <Agenda board={data} />
    </Page>
  );
}

/**
 * Polls waiting on you, above everything else — the only thing on the board that asks the reader
 * for something rather than telling them something. It renders nothing at all when nothing is
 * waiting: a permanent empty slot would train people to stop looking at exactly the place the ask
 * appears.
 */
function YourTurn({ board }: { board: BoardDto }) {
  const theme = useTheme();
  if (board.awaiting.length === 0) return null;

  return (
    <Section title="Your turn">
      <RuledList>
        {board.awaiting.map((poll) => (
          /*
            Pressable, which it was not. This is the only thing in the app allowed to ask the
            reader for something, and on the phone it named a question, said who was waiting, and
            gave you nowhere to press — you had to notice the Asks tab and find the question again
            in a list. A nag that cannot be acted on is worse than no nag.
          */
          <Pressable
            key={poll.id}
            onPress={() => router.navigate('/polls')}
            accessibilityRole="button"
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            <Text style={[styles.pollTitle, { color: theme.text }]}>{poll.title}</Text>
            <Copy muted style={styles.pollHint}>
              {/* Never "Brandon is waiting on you" to Brandon — the server sends null for that. */}
              {poll.waitingOnName
                ? `${poll.waitingOnName.split(' ')[0]} is waiting on you`
                : 'you haven’t answered yet'}
            </Copy>
          </Pressable>
        ))}
      </RuledList>
    </Section>
  );
}

/**
 * Who's around today. A row of faces, read in about a second.
 *
 * The state is carried by the face itself rather than by a word beside it: a full-colour avatar is
 * here, a dimmed one is away, and a *dotted empty circle* is somebody who has not said. Nobody
 * reads a list of five names and five statuses every morning; everybody can see five faces.
 *
 * The dotted circle is the load-bearing one. It has to read as a hole where a person should be —
 * not as a fourth kind of person — because the whole board rests on the difference between
 * somebody who said no and somebody who said nothing.
 */
function Today({ board }: { board: BoardDto }) {
  const theme = useTheme();

  if (board.presence.length === 0) {
    return (
      <Section title="Today">
        <Copy muted>No one has a profile yet.</Copy>
      </Section>
    );
  }

  return (
    <Section title="Today">
      <View style={styles.todayRow}>
        {board.presence.map((row) => (
          <View key={row.profileId} style={styles.todayPerson}>
            {row.state === null ? (
              <View
                style={[styles.todayBlank, { borderColor: theme.border }]}
                accessibilityElementsHidden
              />
            ) : (
              <PersonBadge
                profileId={row.profileId}
                avatarPath={row.avatarPath}
                size={44}
                // Dimmed rather than greyed: the face is still recognisable, which is what makes
                // "away" read as a state of a person rather than as a different person.
                style={row.state === 'AWAY' ? { opacity: 0.35 } : undefined}
              />
            )}
            <Copy style={styles.todayName} numberOfLines={1}>
              {row.name.split(' ')[0]}
            </Copy>
            <Text style={[styles.todayState, { color: theme.textSecondary }]} numberOfLines={1}>
              {row.state === 'AROUND'
                ? 'HERE'
                : row.state === 'AWAY'
                  ? (row.note ?? 'AWAY').toUpperCase()
                  : 'NOTHING SAID'}
            </Text>
          </View>
        ))}
      </View>
    </Section>
  );
}

/**
 * The lede. For a family that no longer lives in one house, "when are we next all in one place"
 * is the question the whole board exists to answer, so it runs first and largest.
 *
 * When it cannot say, it says *who it is waiting for*. The countdown still declines while anybody
 * is unsaid — silence is never a yes — but it used to decline in silence of its own, and a
 * headline that reads "nothing on the calendar yet" every day is a headline nobody reads.
 */
function Gathering({ board }: { board: BoardDto }) {
  const theme = useTheme();
  const { gathering } = board;

  if (!gathering) {
    return (
      <Section title="All together">
        {board.unsaid.length > 0 ? (
          <>
            <Text style={[styles.lede, { color: theme.text }]}>
              Waiting on{' '}
              {joinNames(
                board.unsaid.map((member) =>
                  member.profileId === board.viewerProfileId ? 'you' : member.name.split(' ')[0],
                ),
              )}
            </Text>
            <Copy muted style={styles.ledeSub}>
              Say your days below.
            </Copy>
          </>
        ) : (
          /*
            Never "in the next year". The gathering scan covers a year and declines on any day
            nobody has spoken for, while the fortnight below is the only thing that writes days —
            so days fifteen onward are unsaid by construction, always.
          */
          <Copy muted>No day in the next two weeks works for everyone.</Copy>
        )}
      </Section>
    );
  }

  const headline =
    gathering.inDays === 0
      ? 'Everyone’s together today'
      : gathering.inDays === 1
        ? 'Everyone’s together tomorrow'
        : `${gathering.inDays} days until everyone’s together`;

  return (
    <Section title="All together">
      <Text style={[styles.lede, { color: theme.text }]}>{headline}</Text>
      <Copy muted style={styles.ledeSub}>
        {formatLongDay(gathering.date)}
      </Copy>
    </Section>
  );
}

/**
 * "Macy", "Macy and Tanner", "you, Macy and 2 more" — a sentence, not a list.
 *
 * "you" is hoisted to the front and the tail truncated at two names, as the ballot does it. Beyond
 * naming the reader properly, the cap keeps the lede one or two lines whatever happens: an
 * uncapped list shrinks as people answer, and every write then shoved the page — and the strip
 * your thumb was on — up by a line.
 */
function joinNames(names: string[]): string {
  const ordered = names.includes('you')
    ? ['you', ...names.filter((name) => name !== 'you')]
    : names;
  if (ordered.length === 0) return '';
  if (ordered.length === 1) return ordered[0];
  if (ordered.length === 2) return `${ordered[0]} and ${ordered[1]}`;
  return `${ordered[0]}, ${ordered[1]} and ${ordered.length - 2} more`;
}

/**
 * The next fortnight, as a grid. The board's resting state — glanced at, not read.
 *
 * This replaced a list of five names and five places, which answered "where is everyone right
 * now" and answered it "not recorded" almost every time. Fourteen columns answer the question the
 * family actually has: where the week overlaps, who has run out of days, which weekend is already
 * spoken for.
 *
 * A filled cell is around, an outlined one is away, and an *empty* one is unsaid — a gap in the
 * paper rather than a third kind of mark. That distinction is the whole reason the countdown can
 * be trusted, so it has to survive being drawn small.
 */
/**
 * The next fortnight — the board's resting state, and now the only place presence is written.
 *
 * The grid is the overview; the strip below it is the editor, and picking a row moves the editor
 * to that person. This replaced a whole second tab that drew the same fourteen days again in the
 * same three marks — one screen was a photograph of the other, and saying "I'm around this
 * weekend" began with a tab change and a scroll past four other people's calendars.
 *
 * The strip exists rather than making the grid cells themselves tappable because of the thumb:
 * fourteen columns on a phone is about twenty points per column, which cannot be hit reliably. The
 * grid stays a picture; the thing you touch is drawn at the size of a finger.
 */
function Fortnight({ board }: { board: BoardDto }) {
  const theme = useTheme();
  const setPresence = useSetPresence();
  const editable = board.grid.filter((row) => row.editable);

  const [selectedId, setSelectedId] = useState<string | null>(
    () =>
      editable.find((row) => row.profileId === board.viewerProfileId)?.profileId ??
      editable[0]?.profileId ??
      null,
  );
  const [mode, setMode] = useState<PresenceStateDto | null>('AROUND');
  const [note, setNote] = useState('');
  const [stroke, setStroke] = useState<{
    profileId: string;
    date: string;
    was: GridCellDto;
    now: PresenceStateDto | null;
  } | null>(null);

  if (board.grid.length === 0) {
    return (
      <Section title="The next two weeks">
        <Copy muted>Nobody’s set up yet.</Copy>
      </Section>
    );
  }

  const selected = board.grid.find((row) => row.profileId === selectedId) ?? null;
  const isSelf = selected?.profileId === board.viewerProfileId;

  /**
   * A tap is the whole act.
   *
   * There used to be a select-then-save step, and it was the worst thing in the app: a staged day
   * was painted in the state you were about to set, so a tapped day and a day you had actually
   * told your family about differed by a two-point border. Walking away without saving looked
   * exactly like having saved.
   */
  function paint(row: GridRowDto, index: number) {
    if (!row.editable || setPresence.isPending) return;
    const date = board.gridDays[index];
    const was = row.days[index];
    // Tapping a day that already says what the brush says takes it back, so the same gesture
    // undoes itself and nobody has to find a third control to clear one day.
    const now = was.state === mode ? null : mode;
    setStroke({ profileId: row.profileId, date, was, now });
    write(row.profileId, date, now, note);
  }

  function write(
    profileId: string,
    date: string,
    state: PresenceStateDto | null,
    withNote: string,
  ) {
    setPresence.mutate(
      {
        profileId,
        state,
        days: [date],
        note: state === null || !withNote.trim() ? null : withNote.trim(),
      },
      {
        onError: (cause) => {
          setStroke(null);
          Alert.alert(
            'That didn’t save',
            cause instanceof ApiError ? cause.message : 'It may be the network. Try again.',
          );
        },
      },
    );
  }

  return (
    <Section title="The next two weeks">
      <View style={styles.gridHead}>
        <View style={styles.gridLabel} />
        {board.gridDays.map((day) => (
          <View key={day} style={styles.gridCellWrap}>
            <Text style={[styles.gridHeadText, { color: theme.textSecondary }]}>
              {formatWeekdayInitial(day)}
            </Text>
            <Text style={[styles.gridHeadDay, { color: theme.textSecondary }]}>
              {formatDayOfMonth(day)}
            </Text>
          </View>
        ))}
      </View>

      {board.grid.map((row) => {
        const picked = row.profileId === selectedId;
        return (
          <Pressable
            key={row.profileId}
            onPress={row.editable ? () => setSelectedId(row.profileId) : undefined}
            accessibilityRole={row.editable ? 'button' : undefined}
            accessibilityState={row.editable ? { selected: picked } : undefined}
            style={[
              styles.gridRow,
              {
                borderTopColor: theme.border,
                backgroundColor: picked ? theme.backgroundSelected : 'transparent',
              },
            ]}
          >
            <View style={styles.gridLabel}>
              <PersonBadge profileId={row.profileId} avatarPath={row.avatarPath} size={22} />
              {/* One line, always. A wrapped "Brandon" pushes its own row taller than the others
                  and the fortnight stops reading as a grid. */}
              <Copy style={styles.gridName} numberOfLines={1}>
                {row.name.split(' ')[0]}
              </Copy>
            </View>
            {row.days.map((cell, index) => (
              <View key={board.gridDays[index]} style={styles.gridCellWrap}>
                <View
                  style={[
                    styles.gridCell,
                    {
                      borderColor: cell.state === null ? theme.border : theme.text,
                      backgroundColor: cell.state === 'AROUND' ? theme.text : 'transparent',
                      borderStyle: cell.state === null ? 'dashed' : 'solid',
                    },
                  ]}
                />
              </View>
            ))}
          </Pressable>
        );
      })}

      {selected ? (
        <View style={[styles.editor, { borderTopColor: theme.border }]}>
          <Copy muted style={styles.editorHint}>
            {isSelf
              ? 'Tap a day to say you’ll be here. Tap it again to take it back.'
              : `You’re saying this for ${selected.name.split(' ')[0]}.`}
          </Copy>
          <Copy muted style={styles.editorHint}>
            {describeHorizon(selected.horizon, isSelf, selected.name.split(' ')[0])}
          </Copy>

          <Brush mode={mode} onMode={setMode} self={isSelf} name={selected.name.split(' ')[0]} />

          <View style={styles.strip}>
            {board.gridDays.map((day, index) => (
              <BigCell
                key={day}
                day={day}
                cell={selected.days[index]}
                onPress={() => paint(selected, index)}
              />
            ))}
          </View>

          <TextInput
            value={note}
            onChangeText={setNote}
            maxLength={200}
            placeholder="Add a note"
            placeholderTextColor={theme.textSecondary + '80'}
            style={[styles.note, { color: theme.text, borderColor: theme.border }]}
          />

          {/*
            The undo is the whole safety net now that a tap writes. It carries what the day said
            before — note and all — because painting over a day deletes the only writing anybody
            does in this app.
          */}
          {/*
            Height reserved, so the first paint of the day does not push the page around simply by
            appearing. On a screen whose whole point is that a tap writes, the thing that says what
            was written must not itself be a layout event.
          */}
          <View style={styles.undo}>
            {stroke ? (
              <>
                <Copy muted style={styles.undoText}>
                  {describeStroke(stroke.date, stroke.now)}
                </Copy>
                <Text
                  onPress={() => {
                    write(stroke.profileId, stroke.date, stroke.was.state, stroke.was.note ?? '');
                    setStroke(null);
                  }}
                  style={[styles.undoAction, { color: theme.primary }]}
                >
                  Undo
                </Text>
              </>
            ) : null}
          </View>
        </View>
      ) : null}
    </Section>
  );
}

/**
 * The brush: what a tap means.
 *
 * A persistent mode rather than a cycle-on-tap, because three states across fourteen cells is what
 * a mode is for. What is gone is the *deferred* part: the mode says what the next tap does, and
 * the tap does it.
 */
function Brush({
  mode,
  onMode,
  self,
  name,
}: {
  mode: PresenceStateDto | null;
  onMode: (next: PresenceStateDto | null) => void;
  self: boolean;
  name: string;
}) {
  const theme = useTheme();
  const options: { setting: PresenceStateDto | null; label: string }[] = [
    { setting: 'AROUND', label: self ? 'I’ll be here' : `${name} will` },
    { setting: 'AWAY', label: self ? 'I won’t' : `${name} won’t` },
    { setting: null, label: self ? 'Nothing said' : `${name} hasn’t said` },
  ];

  return (
    <View style={styles.brush} accessibilityRole="radiogroup">
      {options.map((option) => {
        const on = option.setting === mode;
        return (
          <Pressable
            key={option.label}
            onPress={() => onMode(option.setting)}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            style={({ pressed }) => [
              styles.brushOption,
              {
                borderColor: on ? theme.text : theme.border,
                backgroundColor: on ? theme.text : 'transparent',
                opacity: pressed ? 0.6 : 1,
              },
            ]}
          >
            {/* The same three marks the calendar uses, so the brush reads as a key to it. */}
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
              style={[styles.brushLabel, { color: on ? theme.background : theme.textSecondary }]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** One day, at the size of a finger. */
function BigCell({ day, cell, onPress }: { day: string; cell: GridCellDto; onPress: () => void }) {
  const theme = useTheme();
  const filled = cell.state === 'AROUND';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${formatLongDay(day)} — ${describeState(cell.state)}`}
      style={({ pressed }) => [styles.bigCellWrap, { opacity: pressed ? 0.6 : 1 }]}
    >
      <Text style={[styles.bigCellWeekday, { color: theme.textSecondary }]}>
        {formatWeekdayInitial(day)}
      </Text>
      <View
        style={[
          styles.bigCell,
          {
            borderColor: cell.state === null ? theme.border : theme.text,
            borderStyle: cell.state === null ? 'dashed' : 'solid',
            backgroundColor: filled ? theme.text : 'transparent',
          },
        ]}
      >
        <Text style={[styles.bigCellDay, { color: filled ? theme.background : theme.text }]}>
          {formatDayOfMonth(day)}
        </Text>
      </View>
    </Pressable>
  );
}

/**
 * How far ahead this person has spoken. Names the day rather than counting them: "said through
 * Sunday" is a fact you can check against your own week.
 */
function describeHorizon(horizon: GridRowDto['horizon'], self: boolean, name: string): string {
  const who = self ? 'You’ve' : `${name} has`;
  switch (horizon.kind) {
    case 'open':
      return `${who} said, until further notice.`;
    case 'unsaid':
      return `${self ? 'You haven’t' : `${name} hasn’t`} said anything about today yet.`;
    case 'through':
      return `${who} said through ${formatLongDay(horizon.date)}.`;
  }
}

/** One vocabulary for the three states, everywhere. */
function describeState(state: PresenceStateDto | null): string {
  return state === 'AROUND' ? 'here' : state === 'AWAY' ? 'away' : 'nothing said';
}

function describeStroke(date: string, now: PresenceStateDto | null): string {
  const day = formatWeekdayShort(date);
  return now === null ? `${day} taken back.` : `${day} set to ${describeState(now)}.`;
}

/**
 * Birthdays and one-off dates, and nothing else.
 *
 * This used to list arrivals and departures too, which is what made it unreadable: a weekend
 * everyone is home produced five near-identical lines saying what the grid above already showed at
 * a glance. What is left is the part the grid cannot show, so the section renders nothing at all
 * when there is none of it — an empty slot that appears every day is a slot people stop reading.
 */
function Agenda({ board }: { board: BoardDto }) {
  if (board.agenda.length === 0) return null;

  return (
    <Section title={`Also in the next ${board.agendaWindowDays} days`}>
      <RuledList>
        {board.agenda.map((entry) => (
          <View key={agendaKey(entry)} style={styles.agendaRow}>
            <DateStamp>{describeRelativeDay(entry.date, board.today).toUpperCase()}</DateStamp>
            <AgendaLine entry={entry} />
          </View>
        ))}
      </RuledList>
    </Section>
  );
}

function AgendaLine({ entry }: { entry: AgendaEntryDto }) {
  const theme = useTheme();
  const subject = entry.kind === 'event' ? entry.title : entry.personName;
  const detail = entry.kind === 'event' ? (entry.note ?? '') : `turns ${entry.turning}`;

  return (
    <Copy style={styles.agendaLine}>
      <Text style={[styles.agendaSubject, { color: theme.text }]}>{subject}</Text>
      {detail ? <Text style={{ color: theme.textSecondary }}> {detail}</Text> : null}
    </Copy>
  );
}

/** Entries have no id of their own except events; the kind and date make the rest unique. */
function agendaKey(entry: AgendaEntryDto): string {
  return entry.kind === 'event'
    ? `event:${entry.eventId}`
    : `${entry.kind}:${entry.profileId}:${entry.date}`;
}

const styles = StyleSheet.create({
  pollTitle: {
    fontFamily: Fonts.serif,
    fontSize: 18,
    lineHeight: 26,
  },
  pollHint: {
    fontSize: 14,
  },
  lede: {
    fontFamily: Fonts.serif,
    fontSize: 36,
    lineHeight: 42,
    fontWeight: '500',
  },
  ledeSub: {
    marginTop: Spacing.two,
  },
  gridHead: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingBottom: Spacing.one,
  },
  // A fixed column so the cells line up under their headings whatever the longest first name is.
  // Sizing it to the content instead lets one long name shift the whole fortnight sideways.
  gridLabel: {
    width: 88,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  gridName: {
    fontSize: 13,
    flexShrink: 1,
  },
  gridRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: Spacing.one + Spacing.half,
  },
  gridCellWrap: {
    flex: 1,
    alignItems: 'center',
  },
  gridHeadText: {
    fontFamily: Fonts.sans,
    fontSize: 9,
    letterSpacing: 0.8,
  },
  gridHeadDay: {
    fontFamily: Fonts.sans,
    fontSize: 9,
    fontVariant: ['tabular-nums'],
    opacity: 0.7,
  },
  // Circles, matching the faces above and the strip on the Around tab. A fortnight of squares
  // reads as a chart; a fortnight of discs reads as people.
  gridCell: {
    width: 16,
    height: 16,
    borderWidth: 1,
    borderRadius: 8,
  },
  editor: {
    marginTop: Spacing.four,
    paddingTop: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: Spacing.three,
  },
  // Reserved: these sentences differ in length and the strip below must not move.
  editorHint: {
    fontSize: 15,
    minHeight: 22,
  },
  brush: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  brushOption: {
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
  brushLabel: {
    fontFamily: Fonts.sans,
    fontSize: 12,
  },
  strip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  // Exactly a seventh of the row, so a column is a weekday and a fortnight is two clean rows.
  bigCellWrap: {
    width: `${100 / 7}%`,
    alignItems: 'center',
    paddingVertical: Spacing.one,
  },
  bigCellWeekday: {
    fontFamily: Fonts.sans,
    fontSize: 9,
    letterSpacing: 1,
    marginBottom: Spacing.half,
  },
  bigCell: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bigCellDay: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    fontVariant: ['tabular-nums'],
  },
  note: {
    fontFamily: Fonts.serif,
    fontSize: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.half,
  },
  undo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 20,
  },
  undoText: {
    fontSize: 14,
  },
  undoAction: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    textDecorationLine: 'underline',
  },
  todayRow: {
    flexDirection: 'row',
  },
  // Each person takes an equal share of the row rather than a fixed width, so five faces stay on
  // one line on a narrow phone — a fixed 56 plus a gap overflowed by a few points and dropped the
  // last person onto a row of their own, which read as if they were somehow separate.
  todayPerson: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.half,
  },
  todayBlank: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  todayName: {
    fontSize: 13,
  },
  // Two lines reserved: "HERE" is one and "NOTHING SAID" is two, and a row that changes height as
  // people answer moves everything below it.
  todayState: {
    fontFamily: Fonts.sans,
    fontSize: 8,
    letterSpacing: 0.6,
    textAlign: 'center',
    minHeight: 20,
  },
  agendaRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.three,
  },
  agendaLine: {
    flex: 1,
  },
  agendaSubject: {
    fontWeight: '600',
  },
  retry: {
    marginTop: Spacing.three,
    fontFamily: Fonts.sans,
    fontSize: 15,
  },
});
