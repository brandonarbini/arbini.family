import { StyleSheet, Text, View } from 'react-native';

import { Page } from '@/components/page';
import { Copy, RuledList, Section } from '@/components/section';
import { WHERE_FIXTURE } from '@/constants/fixtures';
import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * The stays you have recorded — read-only for now.
 *
 * The web's `/home/where` is a full editor. Writes need `POST/PATCH/DELETE /api/v1/stays`, which
 * also has to reproduce the second ownership check in `app/home/where/actions.ts`, so this screen
 * lists and does not yet edit. The editor arrives with that endpoint.
 */
export default function WhereScreen() {
  const theme = useTheme();
  const { stays } = WHERE_FIXTURE;

  return (
    <Page dateline={WHERE_FIXTURE.dateline}>
      <Section title="Where I am">
        {stays.length === 0 ? (
          <Copy muted>Nothing recorded. Until you add a stay, the board shows you as unknown.</Copy>
        ) : (
          <RuledList>
            {stays.map((stay) => (
              <View key={stay.id} style={styles.stayRow}>
                <View style={styles.stayText}>
                  <Copy style={styles.stayPlace}>{stay.place}</Copy>
                  <Copy muted style={styles.stayDates}>
                    {stay.dates}
                    {stay.note ? ` · ${stay.note}` : ''}
                  </Copy>
                </View>
                {stay.openEnded ? (
                  <Text style={[styles.flag, { color: theme.primary, borderColor: theme.primary }]}>
                    OPEN
                  </Text>
                ) : null}
              </View>
            ))}
          </RuledList>
        )}
      </Section>

      <Section title="Editing">
        <Copy muted>
          Adding and changing stays still happens on the web. It moves here once the write API
          lands.
        </Copy>
      </Section>
    </Page>
  );
}

const styles = StyleSheet.create({
  stayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  stayText: {
    flex: 1,
  },
  stayPlace: {
    fontSize: 18,
  },
  stayDates: {
    fontSize: 14,
  },
  flag: {
    fontFamily: Fonts.sans,
    fontSize: 9,
    letterSpacing: 1.4,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    overflow: 'hidden',
  },
});
