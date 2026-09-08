import type { BoardDto, MeDto } from '@server/api/v1/dto';
import { useQuery } from '@tanstack/react-query';

import { apiGet } from '@/lib/api';

/**
 * Query keys, in one place.
 *
 * One key per endpoint, mirroring the server's cache tags. When writes arrive, invalidating
 * `board` after a mutation will be the client-side counterpart of `BOARD_TAGS.stays` invalidating
 * `/home` — the same idea expressed on both sides of the wire, which is the point of keeping the
 * naming aligned.
 */
export const queryKeys = {
  me: ['me'] as const,
  board: ['board'] as const,
};

export function useBoard() {
  return useQuery({
    queryKey: queryKeys.board,
    queryFn: ({ signal }) => apiGet<BoardDto>('/api/v1/board', signal),
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
