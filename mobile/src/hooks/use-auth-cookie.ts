import { useQuery } from '@tanstack/react-query';

import { authClient, getSessionCookie } from '@/lib/auth-client';

/**
 * The session cookie, for the one request this app makes that `apiGet` cannot.
 *
 * `expo-image` performs its own HTTP request for an avatar, and React Native has no cookie jar to
 * attach the session invisibly — so the header has to be handed to it, and reading it out of the
 * keychain is asynchronous. A query rather than a `useEffect` because every avatar on a screen
 * wants the same answer, and React Query already collapses that to one read.
 *
 * Keyed on the *session* rather than the person, and otherwise never stale. Signing out revokes
 * the cookie and signing back in mints a new one, so an account-shaped key would go on pointing at
 * a dead credential — for as long as React Query keeps an inactive query around, every avatar
 * answering 401 until the app was restarted. A session id changes at exactly the moment this needs
 * re-reading and at no other.
 *
 * The id, not the token: either detects the change, and only one of them puts a live credential
 * somewhere devtools print in full.
 */
export function useAuthCookie() {
  const { data: session } = authClient.useSession();
  const sessionId = session?.session.id ?? null;

  return useQuery({
    queryKey: ['auth-cookie', sessionId],
    queryFn: () => getSessionCookie(),
    enabled: sessionId !== null,
    staleTime: Infinity,
  });
}
