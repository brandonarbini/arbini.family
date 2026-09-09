import { useCallback, useState } from 'react';

/**
 * A pull-to-refresh spinner that only ever answers to a pull.
 *
 * `RefreshControl.refreshing` is not a status light — on iOS, setting it true *performs* the
 * gesture: the spinner appears and the content is pushed down about sixty points, then snaps back
 * when it goes false. Wiring it to TanStack Query's `isRefetching` therefore turned every
 * background refetch into a visible lurch.
 *
 * Which was every tap. Painting a day invalidates the board, the board refetches, `isRefetching`
 * flips true and back, and the page jumped under the thumb — while nothing on it had changed
 * height at all. The board is the one screen that writes, so it is the one screen where a
 * refetch-driven spinner is unusable.
 *
 * So the flag tracks the *gesture* rather than the query. A pull shows the spinner until its
 * refetch settles; nothing else ever shows it.
 */
export function usePullToRefresh(refetch: () => Promise<unknown>) {
  const [pulling, setPulling] = useState(false);

  const onRefresh = useCallback(async () => {
    setPulling(true);
    try {
      await refetch();
    } finally {
      // `finally`, because a refetch that rejects still ends the gesture. Leaving the spinner
      // running on a failed pull is how a screen comes to look permanently busy offline.
      setPulling(false);
    }
  }, [refetch]);

  return { refreshing: pulling, onRefresh };
}
