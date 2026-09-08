import type { StayDto, StayListDto } from '@server/api/v1/dto';
import { Link } from 'expo-router';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { Page } from '@/components/page';
import { Copy, RuledList, Section } from '@/components/section';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/lib/api';
import { formatShortDay } from '@/lib/dates';
import { useWhere } from '@/lib/queries';

/**
 * The stays you have recorded, and the way to change them.
 *
 * A parent sees everyone's lists and a kid sees only their own — decided by the server, not
 * filtered here. A row the viewer cannot edit is a row they should never have been shown, and
 * making that one answer rather than one per client keeps the phone and the web agreeing.
 */
export default function WhereScreen() {
  const { data, isPending, error, refetch, isRefetching } = useWhere();

  if (isPending) return <Page dateline="Loading">{null}</Page>;

  if (error) {
    return (
      <Page dateline="Not loaded">
        <Section title="Where I am">
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
      dateline="Where I am"
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
    >
      {data.lists.map((list) => (
        <StayList key={list.profileId} list={list} today={data.today} />
      ))}
    </Page>
  );
}

function StayList({ list, today }: { list: StayListDto; today: string }) {
  const theme = useTheme();

  return (
    <Section title={list.name}>
      {list.stays.length === 0 ? (
        <Copy muted>Nothing recorded. Until there is, the board shows them as unknown.</Copy>
      ) : (
        <RuledList>
          {list.stays.map((stay) => (
            <StayRow key={stay.id} stay={stay} today={today} />
          ))}
        </RuledList>
      )}

      <Link href={{ pathname: '/stay/new', params: { profileId: list.profileId } }} asChild>
        <Pressable
          style={({ pressed }) => [
            styles.add,
            { borderColor: theme.text, opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <Text style={[styles.addLabel, { color: theme.text }]}>ADD A STAY</Text>
        </Pressable>
      </Link>
    </Section>
  );
}

function StayRow({ stay, today }: { stay: StayDto; today: string }) {
  const theme = useTheme();
  const openEnded = stay.endsOn === null;
  // A stay whose last day has passed is history, not plan. Worth showing — it is how you notice a
  // date never corrected — but not worth the same weight as one that still applies.
  const past = stay.endsOn !== null && stay.endsOn < today;

  return (
    // The row layout lives on an inner View rather than on the Pressable: `Link asChild` clones the
    // child and supplies its own style, which silently replaced the flex direction and left the
    // OPEN badge stretched across its own line.
    <Link href={{ pathname: '/stay/[id]', params: { id: stay.id } }} asChild>
      <Pressable style={({ pressed }) => ({ opacity: pressed ? 0.6 : past ? 0.55 : 1 })}>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Copy style={styles.place}>{stay.place.name}</Copy>
            <Copy muted style={styles.dates}>
              {formatShortDay(stay.startsOn)}
              {stay.endsOn === null ? ' onwards' : ` – ${formatShortDay(stay.endsOn)}`}
              {stay.note ? ` · ${stay.note}` : ''}
            </Copy>
          </View>
          {openEnded ? (
            <Text style={[styles.flag, { color: theme.primary, borderColor: theme.primary }]}>
              OPEN
            </Text>
          ) : null}
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  rowText: {
    flex: 1,
  },
  place: {
    fontSize: 18,
  },
  dates: {
    fontSize: 14,
  },
  flag: {
    alignSelf: 'center',
    fontFamily: Fonts.sans,
    fontSize: 9,
    letterSpacing: 1.4,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    overflow: 'hidden',
  },
  add: {
    marginTop: Spacing.three,
    borderRadius: Radius,
    borderWidth: 1,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  addLabel: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.6,
  },
});
