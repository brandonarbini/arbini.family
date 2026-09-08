import type { AgendaEntryDto, BoardDto } from '@server/api/v1/dto';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';

import { Page } from '@/components/page';
import { PersonBadge } from '@/components/person-badge';
import { Copy, DateStamp, RuledList, Section } from '@/components/section';
import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/lib/api';
import { describeRelativeDay, formatDateline, formatLongDay, formatShortDay } from '@/lib/dates';
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
      <Gathering board={data} />
      <Presence board={data} />
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
 * The lede. For a family that no longer lives in one house, "when are we next all in the same
 * room" is the question the whole board exists to answer, so it runs first and largest.
 */
function Gathering({ board }: { board: BoardDto }) {
  const theme = useTheme();
  const { gathering } = board;

  if (!gathering) {
    return (
      <Section title="All together">
        <Copy muted>
          Nothing on the calendar yet where everyone is in the same place. Add where you’ll be and
          it’ll show up here.
        </Copy>
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
        {formatLongDay(gathering.date)} at {gathering.place.name}
      </Copy>
    </Section>
  );
}

/** Where each person is right now. The board's resting state — glanced at, not read. */
function Presence({ board }: { board: BoardDto }) {
  return (
    <Section title="Right now">
      <RuledList>
        {board.presence.map((row) => (
          <View key={row.profileId} style={styles.presenceRow}>
            <PersonBadge profileId={row.profileId} avatarPath={row.avatarPath} size={40} />
            <Copy style={styles.presenceName}>{row.name}</Copy>
            {row.place ? (
              <Copy muted style={styles.presencePlace}>
                {row.place.name}
                {row.until ? ` · until ${formatShortDay(row.until)}` : ''}
              </Copy>
            ) : (
              // Distinguished from "at home" on purpose: an unknown location is a gap in the
              // data, and quietly defaulting it to home would make the countdown above
              // confidently wrong.
              <Copy muted style={[styles.presencePlace, styles.notRecorded]}>
                not recorded
              </Copy>
            )}
          </View>
        ))}
      </RuledList>
    </Section>
  );
}

function Agenda({ board }: { board: BoardDto }) {
  if (board.agenda.length === 0) {
    return (
      <Section title={`Next ${board.agendaWindowDays} days`}>
        <Copy muted>Nothing coming up.</Copy>
      </Section>
    );
  }

  return (
    <Section title={`Next ${board.agendaWindowDays} days`}>
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
  const detail =
    entry.kind === 'event'
      ? (entry.note ?? '')
      : entry.kind === 'birthday'
        ? `turns ${entry.turning}`
        : entry.kind === 'arrival'
          ? `arrives at ${entry.placeName}`
          : `leaves ${entry.placeName}`;

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
  presenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  presenceName: {
    fontSize: 18,
  },
  presencePlace: {
    marginLeft: 'auto',
    textAlign: 'right',
    flexShrink: 1,
  },
  notRecorded: {
    fontStyle: 'italic',
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
