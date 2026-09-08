import * as React from 'react';
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewProps,
} from 'react-native';

import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * The native port of the web app's `components/ui/section.tsx`.
 *
 * A section set the way a newspaper sets one: a letterspaced head, a heavy rule under it, then
 * the content — no box, no fill, no shadow. A bordered container is the single loudest
 * "application" signal in a layout, and print gets the same grouping from rule and whitespace at
 * a fraction of the ink.
 *
 * The head stays in the sans rather than the serif for the same reason it does on the web: at
 * this size and letterspacing a serif's detail turns to noise, and keeping the furniture in one
 * voice leaves the serif to mean "this is a headline".
 */
export function Section({
  title,
  children,
  style,
  ...rest
}: ViewProps & { title: string; children: React.ReactNode }) {
  const theme = useTheme();

  return (
    <View style={[styles.section, style]} {...rest}>
      <Text style={[styles.head, { color: theme.textSecondary }]}>{title.toUpperCase()}</Text>
      {/* The heavy half of a Scotch rule. Weight is what makes a rule read as structure. */}
      <View style={[styles.rule, { backgroundColor: theme.text }]} />
      <View style={styles.body}>{children}</View>
    </View>
  );
}

/**
 * Rows divided by hairlines rather than wrapped in a container. The final row draws no rule —
 * ending a section on one reads as a second, weaker section break.
 */
export function RuledList({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  const rows = React.Children.toArray(children);

  return (
    <View>
      {rows.map((row, index) => (
        <View
          key={index}
          style={[
            styles.row,
            index < rows.length - 1 && {
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: theme.border,
            },
          ]}
        >
          {row}
        </View>
      ))}
    </View>
  );
}

/** Body copy. The serif carries everything the reader actually reads. */
export function Copy({
  children,
  muted = false,
  style,
}: {
  children: React.ReactNode;
  muted?: boolean;
  style?: StyleProp<TextStyle>;
}) {
  const theme = useTheme();
  return (
    <Text style={[styles.copy, { color: muted ? theme.textSecondary : theme.text }, style]}>
      {children}
    </Text>
  );
}

/**
 * The fixed-width date column of a listings page. Uppercase, letterspaced and tabular so the eye
 * can run down the dates instead of reading each line from the start.
 */
export function DateStamp({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  return <Text style={[styles.stamp, { color: theme.textSecondary }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  section: {
    marginBottom: Spacing.five,
  },
  head: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 2.2,
  },
  // A filled view, not a top border — the same idiom as the masthead's Scotch rule. A border on a
  // view with no intrinsic height silently fails to paint once the width goes sub-pixel, so every
  // standalone rule in this app is drawn as a height plus a background rather than as an edge.
  rule: {
    marginTop: Spacing.two,
    height: 2,
  },
  body: {
    paddingTop: Spacing.three,
  },
  row: {
    paddingVertical: Spacing.two + Spacing.half,
  },
  copy: {
    fontFamily: Fonts.serif,
    fontSize: 16,
    lineHeight: 24,
  },
  stamp: {
    width: 104,
    fontFamily: Fonts.sans,
    fontSize: 11,
    letterSpacing: 1.5,
    fontVariant: ['tabular-nums'],
  },
});
