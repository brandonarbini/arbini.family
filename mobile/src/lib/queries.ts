import type {
  BoardDto,
  MeDto,
  PasskeyDto,
  PollDto,
  PresenceInputDto,
  ReplyInputDto,
} from '@server/api/v1/dto';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiGet, apiSend } from '@/lib/api';
import { authClient } from '@/lib/auth-client';

/**
 * Query keys, in one place.
 *
 * One key per endpoint, mirroring the server's cache tags.
 */
export const queryKeys = {
  me: ['me'] as const,
  board: ['board'] as const,

  polls: ['polls'] as const,
  /**
   * Scoped to the account, unlike every key above it. The board is the same board for everyone in
   * the family, but a passkey list is one person's — and the cache outlives a sign-out, so an
   * unscoped key would show the previous account's credentials to whoever signs in next on the
   * same phone. Null while the session is still resolving; nothing fetches against that.
   */
  passkeys: (userId: string | null) => ['passkeys', userId] as const,
};

export function useBoard() {
  return useQuery({
    queryKey: queryKeys.board,
    queryFn: ({ signal }) => apiGet<BoardDto>('/api/v1/board', signal),
  });
}

export function usePolls() {
  return useQuery({
    queryKey: queryKeys.polls,
    queryFn: ({ signal }) => apiGet<PollDto[]>('/api/v1/polls', signal),
  });
}

/**
 * Answer one option.
 *
 * No `profileId` — the server takes it from the session, because only you may answer for you.
 * That is stricter than the Around strip, where a parent may act for a kid, and the difference is
 * deliberate: a poll answer is a statement of intent in somebody's own voice.
 */
export function useAnswerPoll() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: ({
      pollId,
      optionId,
      kind,
    }: {
      pollId: string;
      optionId: string;
      kind: ReplyInputDto['kind'];
    }) =>
      apiSend<void>('PUT', `/api/v1/polls/${pollId}/options/${optionId}/reply`, {
        kind,
      } satisfies ReplyInputDto),
    // The board carries "your turn", so an answer changes it as surely as it changes the ballot.
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: queryKeys.polls }),
        client.invalidateQueries({ queryKey: queryKeys.board }),
      ]),
  });
}

export function useMe() {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: ({ signal }) => apiGet<MeDto>('/api/v1/me', signal),
    // Who you are does not change while the app is open; the board does.
    staleTime: Infinity,
  });
}

/**
 * Say what a stretch of days looks like — or take it back.
 *
 * One hook and one endpoint, where the stay editor needed three of each. A day has no id to
 * address: the request names a person and a set of days, and afterwards the calendar says what it
 * was told however many rows that took. Setting a null `state` clears those days rather than
 * recording an away, the same way a null `kind` clears a poll answer.
 */
export function useSetPresence() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (input: PresenceInputDto) =>
      apiSend<{ ok: true }>('PUT', '/api/v1/presence', input),
    onSuccess: () => invalidatePresence(client),
  });
}

/** Saying where you'll be changes the countdown, the grid and the agenda — all of one board. */
function invalidatePresence(client: ReturnType<typeof useQueryClient>) {
  return client.invalidateQueries({ queryKey: queryKeys.board });
}

/**
 * Passkeys.
 *
 * The list comes from `/api/v1/passkeys` like everything else here, and arrives already named —
 * see `PasskeyDto`. That is the whole reason this endpoint exists rather than the app calling
 * Better Auth's `list-user-passkeys` directly: naming an unnamed credential means mapping its
 * AAGUID to "1Password" or "iCloud Keychain", and a table that ships inside a binary is a table
 * that goes stale on every phone that has not updated.
 *
 * The two writes do go straight to Better Auth, which already checks that the row belongs to the
 * caller. There is no v1 route for them and nothing this app would gain from one.
 */

/** The session-scoped cache key, and whether there is a session to scope it to. */
function usePasskeyScope() {
  const { data: session } = authClient.useSession();
  const userId = session?.user?.id ?? null;

  return { userId, queryKey: queryKeys.passkeys(userId) };
}

export function usePasskeys() {
  const { userId, queryKey } = usePasskeyScope();

  return useQuery({
    queryKey,
    queryFn: ({ signal }) => apiGet<PasskeyDto[]>('/api/v1/passkeys', signal),
    // Nothing to ask for until we know whose passkeys to ask about. Without this the first render
    // after a cold start fetches against a null key and caches the answer under it.
    enabled: userId !== null,
  });
}

/**
 * Refetch the list after a registration.
 *
 * Adding a passkey happens in `lib/passkey-client.ts`, which calls Better Auth's `$fetch` directly
 * rather than through the client's path proxy — so the plugin's own cache signals never fire, and
 * the one action most likely to change the list is the one that would leave it stale.
 */
export function useInvalidatePasskeys() {
  const client = useQueryClient();
  const { queryKey } = usePasskeyScope();

  return () => client.invalidateQueries({ queryKey });
}

export function useRenamePasskey() {
  const client = useQueryClient();
  const { queryKey } = usePasskeyScope();

  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await authClient.passkey.updatePasskey({ id, name });
      // Better Auth resolves its failures rather than throwing them; React Query needs the opposite.
      if (error) throw new Error(error.message ?? 'Could not rename that passkey.');
    },
    onSuccess: () => client.invalidateQueries({ queryKey }),
  });
}

export function useDeletePasskey() {
  const client = useQueryClient();
  const { queryKey } = usePasskeyScope();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await authClient.passkey.deletePasskey({ id });
      if (error) throw new Error(error.message ?? 'Could not remove that passkey.');
    },
    onSuccess: () => client.invalidateQueries({ queryKey }),
  });
}
