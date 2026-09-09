import { StyleSheet, Text } from 'react-native';

import { Page } from '@/components/page';
import { Copy, Section } from '@/components/section';
import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/lib/api';

/**
 * A screen that could not load, with a way out.
 *
 * Shared because two of the three data tabs did not have one: they printed "Could not reach the
 * board" with no retry and no `refreshControl`, so the only escape from being offline was to
 * switch tabs and come back. The board had a proper retry and the others did not, and nothing
 * explained the difference.
 *
 * An unauthenticated failure gets no retry on purpose — the gate in `_layout.tsx` is already
 * navigating to sign-in, and a button on the way out is noise.
 */
export function LoadFailure({
  title,
  error,
  onRetry,
}: {
  /** The screen's own name, not a status. The dateline is where the date goes. */
  title: string;
  error: Error;
  onRetry: () => void;
}) {
  const theme = useTheme();
  const unauthenticated = error instanceof ApiError && error.code === 'unauthenticated';

  return (
    <Page dateline={title}>
      <Section title={title}>
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

const styles = StyleSheet.create({
  retry: {
    marginTop: Spacing.three,
    fontFamily: Fonts.sans,
    fontSize: 13,
    textDecorationLine: 'underline',
  },
});
