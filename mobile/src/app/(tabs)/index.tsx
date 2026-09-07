import { StyleSheet, Text, View } from 'react-native';

import { Page } from '@/components/page';
import { PersonBadge } from '@/components/person-badge';
import { Copy, DateStamp, RuledList, Section } from '@/components/section';
import { BOARD_FIXTURE } from '@/constants/fixtures';
import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * The board, in the same order the web sets it: what is being asked of you, then the lede, then
 * the resting state, then the listings.
 *
 * Reads from a fixture. The API this will call does not exist yet — Stage 3 replaces
 * `BOARD_FIXTURE` with a `useQuery` against `/api/v1/board` and nothing else on this screen
 * should have to move.
 */
export default function BoardScreen() {
  const board = BOARD_FIXTURE;

  return (
    <Page dateline={board.dateline}>
      <YourTurn polls={board.awaiting} />
      <Gathering gathering={board.gathering} />
      <Presence presence={board.presence} />
      <Agenda agenda={board.agenda} />
    </Page>
  );
}

/**
 * Polls waiting on you, above everything else — the only thing on the board that asks the reader
 * for something rather than telling them something. It renders nothing at all when nothing is
 * waiting: a permanent empty "no polls" slot would train people to stop looking at exactly the
 * place the ask appears.
 */
function YourTurn({ polls }: { polls: typeof BOARD_FIXTURE.awaiting }) {
  const theme = useTheme();
  if (polls.length === 0) return null;

  return (
    <Section title="Your turn">
      <RuledList>
        {polls.map((poll) => (
          <View key={poll.id}>
            <Text style={[styles.pollTitle, { color: theme.text }]}>{poll.title}</Text>
            <Copy muted style={styles.pollHint}>
              {poll.waitingOn}
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
function Gathering({ gathering }: { gathering: typeof BOARD_FIXTURE.gathering }) {
  const theme = useTheme();

  if (!gathering) {
    return (
      <Section title="All together">
        <Copy muted>
          Nothing on the calendar yet where everyone is in the same place. Add where you&rsquo;ll be
          and it&rsquo;ll show up here.
        </Copy>
      </Section>
    );
  }

  return (
    <Section title="All together">
      <Text style={[styles.lede, { color: theme.text }]}>{gathering.headline}</Text>
      <Copy muted style={styles.ledeSub}>
        {gathering.when} at {gathering.place}
      </Copy>
    </Section>
  );
}

/** Where each person is right now. The board's resting state — glanced at, not read. */
function Presence({ presence }: { presence: typeof BOARD_FIXTURE.presence }) {
  return (
    <Section title="Right now">
      <RuledList>
        {presence.map((row) => (
          <View key={row.profileId} style={styles.presenceRow}>
            <PersonBadge name={row.name} size={40} />
            <Copy style={styles.presenceName}>{row.name}</Copy>
            {row.place ? (
              <Copy muted style={styles.presencePlace}>
                {row.place}
                {row.until ? ` · until ${row.until}` : ''}
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

function Agenda({ agenda }: { agenda: typeof BOARD_FIXTURE.agenda }) {
  const theme = useTheme();

  if (agenda.length === 0) {
    return (
      <Section title="Next 14 days">
        <Copy muted>Nothing coming up.</Copy>
      </Section>
    );
  }

  return (
    <Section title="Next 14 days">
      <RuledList>
        {agenda.map((entry) => (
          <View key={entry.id} style={styles.agendaRow}>
            <DateStamp>{entry.when.toUpperCase()}</DateStamp>
            <Copy style={styles.agendaLine}>
              <Text style={[styles.agendaSubject, { color: theme.text }]}>{entry.subject}</Text>
              <Text style={{ color: theme.textSecondary }}> {entry.detail}</Text>
            </Copy>
          </View>
        ))}
      </RuledList>
    </Section>
  );
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
});
