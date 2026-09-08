import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { ApiError, NetworkError } from '@/lib/api';

/**
 * React Query, configured for a board rather than a feed.
 *
 * The defaults assume a browser tab: refetch when the window regains focus, retry a few times.
 * Neither idea arrives for free on a phone — there is no window — so `focusManager` is wired to
 * `AppState` below. That single hook-up is most of what makes the app feel current: the family
 * opens it when somebody asks a question, and what they see should not be from last Tuesday.
 */
function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // The board changes when somebody records a stay, which is rare — but "rare" is not
        // "never", and coming back to the app is exactly when a stale answer is most annoying.
        staleTime: 30_000,
        retry: (failureCount, error) => {
          // Retrying a 401 or a 403 just asks the same refused question again. A network failure
          // is worth a couple of goes; a refusal is not.
          if (error instanceof ApiError) return false;
          if (error instanceof NetworkError) return failureCount < 2;
          return failureCount < 2;
        },
      },
    },
  });
}

/**
 * `focusManager` is what React Query consults to decide whether the app is being looked at.
 * Without this it never becomes "focused" on native and `refetchOnWindowFocus` is inert.
 */
function useAppStateFocus() {
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status: AppStateStatus) => {
      focusManager.setFocused(status === 'active');
    });
    return () => subscription.remove();
  }, []);
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  // Created once per mount rather than at module scope, so a fast refresh does not leave two
  // clients disagreeing about the cache.
  const [client] = useState(createQueryClient);
  useAppStateFocus();

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
