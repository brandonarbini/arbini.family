import { useSyncExternalStore } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

/**
 * Static rendering hands the browser HTML produced without a colour scheme, so the value has to be
 * recomputed once the client takes over or the first paint disagrees with the markup.
 *
 * `useSyncExternalStore` is what expresses that: it is given a server snapshot of `false` and a
 * client snapshot of `true`, so React itself reports which side of hydration we are on. The
 * template shipped this as `useState(false)` plus a `setState` in an empty effect, which computes
 * the same answer by way of a second render pass — and trips `react-hooks/set-state-in-effect`.
 */
const subscribe = () => () => {};

export function useColorScheme() {
  const hasHydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const colorScheme = useRNColorScheme();

  return hasHydrated ? colorScheme : 'light';
}
