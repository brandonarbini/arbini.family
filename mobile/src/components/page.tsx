import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ScrollViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Wordmark } from '@/components/wordmark';
import { BottomTabInset, Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * The masthead and paper ground every screen sits on — the native counterpart of
 * `components/app-shell.tsx`.
 *
 * The rules under the wordmark are a Scotch rule: a heavy line with a hairline set just beneath
 * it, which is what the web draws (`border-t-2`, then `mt-[3px] border-t`). The pair is the point.
 * A single rule of either weight reads as a divider; the two together read as a masthead, and it
 * is the oldest trick on a front page.
 */
export function Page({
  dateline,
  children,
  refreshControl,
}: {
  dateline: string;
  children: React.ReactNode;
  refreshControl?: ScrollViewProps['refreshControl'];
}) {
  const theme = useTheme();

  return (
    <View style={[styles.ground, { backgroundColor: theme.background }]}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="automatic"
          /*
           * Keep what you are looking at where it is when something above it resizes.
           *
           * The board is a stack of derived summaries with the editor underneath, so writing a day
           * re-renders the lede, the Today row and the grid — all of which sit above the strip your
           * thumb is on. Any of them changing height dragged the strip out from under the finger
           * between taps. This is the platform's answer to content growing above the viewport, and
           * it is the right one: the alternative is pinning a height to every summary on the page
           * and hoping none of them ever wraps differently.
           */
          maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
          refreshControl={refreshControl}
        >
          <View style={styles.masthead}>
            <View style={styles.wordmark}>
              <Wordmark />
            </View>
            <View style={[styles.scotchHeavy, { backgroundColor: theme.text }]} />
            <View style={[styles.scotchThin, { backgroundColor: theme.text }]} />
            <Text style={[styles.dateline, { color: theme.textSecondary }]}>
              {dateline.toUpperCase()}
            </Text>
          </View>
          {children}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  ground: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.five,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  masthead: {
    paddingTop: Spacing.three,
    marginBottom: Spacing.five,
  },
  wordmark: {
    alignItems: 'center',
  },
  // Filled views rather than top borders. A sub-pixel *border* on a view with no intrinsic height
  // rounds away to nothing and never paints — which is why the thin half of the rule was invisible
  // while the row separators in RuledList, drawn on views that do have content, were fine. Giving
  // the rule a height and a background makes it a thing rather than an edge of a thing.
  scotchHeavy: {
    marginTop: Spacing.three,
    height: 2,
  },
  scotchThin: {
    marginTop: 3,
    height: StyleSheet.hairlineWidth,
  },
  dateline: {
    marginTop: Spacing.three,
    fontFamily: Fonts.sans,
    fontSize: 10,
    letterSpacing: 1.8,
    textAlign: 'center',
  },
});
