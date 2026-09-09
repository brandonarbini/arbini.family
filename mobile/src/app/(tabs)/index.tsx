import type { AgendaEntryDto, BoardDto } from '@server/api/v1/dto';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';

import { Page } from '@/components/page';
import { PersonBadge } from '@/components/person-badge';
import { Copy, DateStamp, RuledList, Section } from '@/components/section';
import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/lib/api';
import {
  describeRelativeDay,
  formatDateline,
  formatDayOfMonth,
  formatLongDay,
  formatWeekdayInitial,
} from '@/lib/dates';
import { useBoard } from '@/lib/queries';

/**
 * The board, in the same order the web sets it: what is being asked of you, then the lede, then
 * the resting state, then the listings.
 */
export default function BoardScreen() {
  const { data, isPending, error, refetch, isRefetching } = useBoard();

  if (isPending) return <Page dateline="Loading">{null}</Page>;
  if (error) return <BoardError error={error} onRetry={refetch} />;

  return (
    <Page
      dateline={formatDateline(data.today)}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
    >
      <YourTurn board={data} />
      <Today board={data} />
      <Gathering board={data} />
      <Grid board={data} />
      <Agenda board={data} />
    </Page>
  );
}

/**
 * A failure the reader can act on, where there is an action, and an honest one where there is not.
 * An unauthenticated response is not shown as an error at all — the gate in `_layout.tsx` is
 * already navigating to sign-in, and a red box on the way out is just noise.
 */
function BoardError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const theme = useTheme();
  const unauthenticated = error instanceof ApiError && error.code === 'unauthenticated';

  return (
    <Page dateline="Not loaded">
      <Section title="The board">
        <Copy muted>
          {unauthenticated
            ? 'Signing you in again…'
            : error instanceof ApiError
              ? error.message
              : 'Could not reach the board. It may be the network.'}
        </Copy>
        {!unauthenticated ? (
          <Text onPress={onRetry} style={[styles.retry, { color: theme.primary }]}>
            Try again
          </Text>
        ) : null}
      </Section>
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
          <View key={poll.id}>
            <Text style={[styles.pollTitle, { color: theme.text }]}>{poll.title}</Text>
            <Copy muted style={styles.pollHint}>
              {/* Never "Brandon is waiting on you" to Brandon — the server sends null for that. */}
              {poll.waitingOnName
                ? `${poll.waitingOnName.split(' ')[0]} is waiting on you`
                : 'you haven’t answered yet'}
            </Copy>
          </View>
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
                  : 'NO WORD'}
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
              Say which days you’ll be around and the countdown starts.
            </Copy>
          </>
        ) : (
          <Copy muted>Nobody’s free on the same day in the next year.</Copy>
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
 * "Macy", "Macy and Tanner", "you, Macy and Tanner" — a sentence, not a list.
 *
 * "you" is hoisted to the front. The lede is the largest type on the board and it was naming the
 * reader in the third person, in the one place the app shouts.
 */
function joinNames(names: string[]): string {
  const ordered = names.includes('you')
    ? ['you', ...names.filter((name) => name !== 'you')]
    : names;
  if (ordered.length <= 1) return ordered[0] ?? '';
  return `${ordered.slice(0, -1).join(', ')} and ${ordered[ordered.length - 1]}`;
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
function Grid({ board }: { board: BoardDto }) {
  const theme = useTheme();

  if (board.grid.length === 0) {
    return (
      <Section title="The next two weeks">
        <Copy muted>No one has a profile yet.</Copy>
      </Section>
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

      {board.grid.map((row) => (
        <View key={row.profileId} style={[styles.gridRow, { borderTopColor: theme.border }]}>
          <View style={styles.gridLabel}>
            <PersonBadge profileId={row.profileId} avatarPath={row.avatarPath} size={22} />
            {/* One line, always. A wrapped "Brandon" pushes its own row taller than the
                others and the fortnight stops reading as a grid. */}
            <Copy style={styles.gridName} numberOfLines={1}>
              {row.name.split(' ')[0]}
            </Copy>
          </View>
          {row.days.map((state, index) => (
            <View key={board.gridDays[index]} style={styles.gridCellWrap}>
              <View
                style={[
                  styles.gridCell,
                  {
                    borderColor: state === null ? theme.border : theme.text,
                    backgroundColor: state === 'AROUND' ? theme.text : 'transparent',
                    borderStyle: state === null ? 'dashed' : 'solid',
                  },
                ]}
              />
            </View>
          ))}
        </View>
      ))}
    </Section>
  );
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
  todayState: {
    fontFamily: Fonts.sans,
    fontSize: 8,
    letterSpacing: 0.8,
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
