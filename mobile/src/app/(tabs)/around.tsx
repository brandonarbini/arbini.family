import type { AroundDto, CalendarDateString, PresenceStateDto, StripDto } from '@server/api/v1/dto';
import { Alert, RefreshControl, StyleSheet, View } from 'react-native';

import { Page } from '@/components/page';
import { PersonBadge } from '@/components/person-badge';
import { Copy, Section } from '@/components/section';
import { Strip, type StripDay } from '@/components/strip';
import { Spacing } from '@/constants/theme';
import { ApiError } from '@/lib/api';
import { addDays, formatLongDay } from '@/lib/dates';
import { useAround, useSetPresence } from '@/lib/queries';

/**
 * What you've said about the coming fortnight, and the way to change it.
 *
 * A parent sees everyone's strips and a kid sees only their own — decided by the server, not
 * filtered here. A strip the viewer cannot paint is a strip they should never have been shown,
 * and making that one answer rather than one per client keeps the phone and the web agreeing.
 */

/** How many days the strip shows. Matches `STRIP_DAYS` on the server, and the board's grid. */
const STRIP_DAYS = 14;

export default function AroundScreen() {
  const { data, isPending, error, refetch, isRefetching } = useAround();
  const setPresence = useSetPresence();

  if (isPending) return <Page dateline="Loading">{null}</Page>;

  if (error) {
    return (
      <Page dateline="Not loaded">
        <Section title="Around">
          <Copy muted>
            {error instanceof ApiError
              ? error.message
              : 'Could not reach the board. It may be the network.'}
          </Copy>
        </Section>
      </Page>
    );
  }

  return (
    <Page
      dateline="Around"
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
    >
      <ParentNote data={data} />
      {data.strips.map((strip) => (
        <StripSection
          key={strip.profileId}
          strip={strip}
          today={data.today}
          isSelf={strip.profileId === data.viewerProfileId}
          pending={setPresence.isPending}
          onSubmit={(input) =>
            setPresence.mutate(
              { profileId: strip.profileId, ...input },
              {
                onError: (cause) =>
                  Alert.alert(
                    "That didn't save",
                    cause instanceof ApiError ? cause.message : 'It may be the network. Try again.',
                  ),
              },
            )
          }
        />
      ))}
    </Page>
  );
}

/**
 * Why there are five calendars here rather than one.
 *
 * A kid gets exactly their own; a parent gets everybody's, which is a power worth naming rather
 * than leaving to be discovered. Before this, the screen simply showed four extra calendars with
 * no explanation of why they were editable or who else could see them.
 */
function ParentNote({ data }: { data: AroundDto }) {
  const others = data.strips.filter((strip) => strip.profileId !== data.viewerProfileId);
  if (others.length === 0) return null;

  const names = joinNames(others.map((strip) => strip.name));

  // No `Section` wrapper: the masthead dateline above already says AROUND, and a section head
  // repeating it reads as a heading for the sentence rather than as the page's own subtitle.
  return (
    <Copy muted style={styles.parentNote}>
      You can fill these in for anyone, because you’re a parent. {names}{' '}
      {others.length === 1 ? 'sees' : 'see'} only their own.
    </Copy>
  );
}

function StripSection({
  strip,
  today,
  isSelf,
  pending,
  onSubmit,
}: {
  strip: StripDto;
  today: CalendarDateString;
  isSelf: boolean;
  pending: boolean;
  onSubmit: (input: {
    state: PresenceStateDto | null;
    days: CalendarDateString[];
    note: string | null;
  }) => void;
}) {
  // Resolved per day from the runs rather than read off a row per day: the storage is a range,
  // and the strip is a projection of it. That is what lets "at school until told otherwise" stay
  // one row instead of a hundred that something has to keep extending.
  const days: StripDay[] = Array.from({ length: STRIP_DAYS }, (_, offset) => {
    const date = addDays(today, offset);
    const run = coveringRun(strip.runs, date);
    return { date, state: run?.state ?? null, note: run?.note ?? null };
  });

  return (
    <Section title={isSelf ? `${strip.name} — you` : strip.name}>
      <View style={styles.head}>
        <PersonBadge profileId={strip.profileId} avatarPath={strip.avatarPath} size={28} />
        <Copy muted style={styles.horizon}>
          {describeHorizon(strip.horizon, isSelf, strip.name.split(' ')[0])}
        </Copy>
      </View>
      <Strip name={strip.name} days={days} isSelf={isSelf} pending={pending} onSubmit={onSubmit} />
    </Section>
  );
}

/**
 * The run covering a day, resolved the way the server's `coveringOn` resolves it.
 *
 * Rows never overlap — every write goes through `setDays` — but the tie-break is kept here for
 * the same reason it is kept there: it is cheap, and a client that disagreed with the server
 * about which run wins would render a strip that contradicts the board beside it.
 */
function coveringRun(runs: StripDto['runs'], date: CalendarDateString) {
  let best: StripDto['runs'][number] | null = null;
  for (const run of runs) {
    if (run.startsOn > date) continue;
    if (run.endsOn !== null && run.endsOn < date) continue;
    if (!best || run.startsOn >= best.startsOn) best = run;
  }
  return best;
}

/**
 * How far ahead this person has said anything.
 *
 * The one line here that is an ask rather than a control, so it names the day rather than
 * counting them: "said through Sunday" is a fact you can check against your own week, where "said
 * for 4 more days" is arithmetic you have to do before you can act on it.
 */
function describeHorizon(horizon: StripDto['horizon'], isSelf: boolean, name: string): string {
  const who = isSelf ? "You've" : `${name} has`;
  switch (horizon.kind) {
    case 'open':
      return `${who} said, until further notice.`;
    case 'unsaid':
      return `${isSelf ? "You haven't" : `${name} hasn't`} said anything about today yet.`;
    case 'through':
      return `${who} said through ${formatLongDay(horizon.date)}.`;
  }
}

const styles = StyleSheet.create({
  parentNote: {
    fontSize: 15,
    marginBottom: Spacing.five,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    marginBottom: Spacing.three,
  },
  horizon: {
    flex: 1,
    fontSize: 15,
  },
});

/** "Macy", "Macy and Tanner", "Macy, Tanner and Addison" — a sentence, not a list. */
function joinNames(names: string[]): string {
  const firsts = names.map((name) => name.split(' ')[0]);
  if (firsts.length <= 1) return firsts[0] ?? '';
  return `${firsts.slice(0, -1).join(', ')} and ${firsts[firsts.length - 1]}`;
}
