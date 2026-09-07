import { StyleSheet, Text, View } from 'react-native';

import { Fonts, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * A square initial in a ruled box, standing in for the web's generated avatar.
 *
 * The web uses `boring-avatars` to draw a deterministic pattern per person. That is a
 * React-DOM-and-SVG library, so rather than pull an SVG renderer into the app for one glyph on
 * one screen, the native badge does what the rest of the design already does: a rule, a right
 * angle, and type. Square, because nothing else here is round.
 */
export function PersonBadge({ name, size = 40 }: { name: string; size?: number }) {
  const theme = useTheme();
  const initial = name.trim().charAt(0).toUpperCase() || '?';

  return (
    <View
      style={[
        styles.badge,
        {
          width: size,
          height: size,
          borderColor: theme.border,
          backgroundColor: theme.backgroundElement,
        },
      ]}
    >
      <Text style={[styles.initial, { color: theme.text, fontSize: size * 0.45 }]}>{initial}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    fontFamily: Fonts.serif,
    fontWeight: '500',
  },
});
