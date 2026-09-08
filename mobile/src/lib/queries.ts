import type { BoardDto, MeDto, StayInputDto, WhereDto } from '@server/api/v1/dto';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiGet, apiSend } from '@/lib/api';

/**
 * Query keys, in one place.
 *
 * One key per endpoint, mirroring the server's cache tags. `BOARD_TAGS.stays` invalidates both
 * `/home` and `/home/where` on the server; here, saving a stay invalidates both `board` and
 * `where` for the same reason. The symmetry is deliberate — it is the same idea expressed on both
 * sides of the wire, and keeping the names aligned is what makes that legible.
 */
export const queryKeys = {
  me: ['me'] as const,
  board: ['board'] as const,
  where: ['where'] as const,
};

export function useBoard() {
  return useQuery({
    queryKey: queryKeys.board,
    queryFn: ({ signal }) => apiGet<BoardDto>('/api/v1/board', signal),
  });
}

export function useWhere() {
  return useQuery({
    queryKey: queryKeys.where,
    queryFn: ({ signal }) => apiGet<WhereDto>('/api/v1/where', signal),
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
 * Create or update a stay.
 *
 * One hook for both because the screen is one form: whether it writes a new row or changes an
 * existing one is a detail of which button opened it, and splitting them would mean the caller
 * choosing a hook before it has anything to say about the difference.
 */
export function useSaveStay() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: ({ stayId, input }: { stayId?: string; input: StayInputDto }) =>
      stayId
        ? apiSend<{ id: string }>('PATCH', `/api/v1/stays/${stayId}`, input)
        : apiSend<{ id: string }>('POST', '/api/v1/stays', input),
    onSuccess: () => invalidateStays(client),
  });
}

export function useDeleteStay() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (stayId: string) => apiSend<void>('DELETE', `/api/v1/stays/${stayId}`),
    onSuccess: () => invalidateStays(client),
  });
}

/**
 * A stay changes where somebody is, so it changes the board as well as the editor — the countdown,
 * the presence rows and the agenda all read the same stays. Invalidating only `where` would leave
 * the board insisting Jill is still at Vanguard after you moved her home.
 */
function invalidateStays(client: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    client.invalidateQueries({ queryKey: queryKeys.where }),
    client.invalidateQueries({ queryKey: queryKeys.board }),
  ]);
}
