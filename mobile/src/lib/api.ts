import type { ApiErrorBody, ApiErrorCode } from '@server/api/v1/dto';

import { authClient } from '@/lib/auth-client';
import { env } from '@/lib/env';

/**
 * The one place this app talks to `/api/v1/*`.
 *
 * Everything about the transport lives here — the base URL, how credentials are attached, how a
 * failure becomes a typed error — so that changing any of it is a change to one file. That is not
 * hypothetical tidiness: the session currently rides as a `Cookie` header, and moving to
 * `Authorization: Bearer` (which the server's `bearer()` plugin already accepts) should be three
 * lines here and nothing anywhere else.
 */

/** A non-2xx response, carrying the server's machine-readable code. */
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly fieldErrors?: Record<string, string[]>;

  constructor(status: number, body: ApiErrorBody['error']) {
    super(body.message);
    this.name = 'ApiError';
    this.status = status;
    this.code = body.code;
    this.fieldErrors = body.fieldErrors;
  }
}

/** The network never reached the server — offline, wrong port, server down. */
export class NetworkError extends Error {
  constructor(cause: unknown) {
    super('Could not reach the board.');
    this.name = 'NetworkError';
    this.cause = cause;
  }
}

export async function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  return request<T>('GET', path, undefined, signal);
}

/** POST / PATCH / DELETE. Returns `undefined` for a 204. */
export async function apiSend<T>(
  method: 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<T> {
  return request<T>(method, path, body);
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  // Better Auth's own client attaches credentials to its `$fetch` calls, but a plain fetch has no
  // cookie jar doing it invisibly — React Native has no cookie jar at all. `getCookie()` reads
  // what expoClient stored in the keychain.
  const cookie = await authClient.getCookie();

  let response: Response;
  try {
    response = await fetch(`${env.apiUrl}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      // Nothing to send credentials *from* — being explicit stops a future reader assuming the
      // browser semantics apply here.
      credentials: 'omit',
      signal,
    });
  } catch (cause) {
    throw new NetworkError(cause);
  }

  if (!response.ok) {
    throw new ApiError(response.status, await readErrorBody(response));
  }

  // 204 has no body, and calling .json() on it throws.
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/**
 * A failed response should carry an `ApiErrorBody`, but the one case that matters most is when it
 * does not: an HTML error page, a proxy timeout, a redirect followed into a sign-in page. Those
 * would throw on `.json()` and surface as a parse error rather than as the failure they are.
 */
async function readErrorBody(response: Response): Promise<ApiErrorBody['error']> {
  try {
    const parsed = (await response.json()) as Partial<ApiErrorBody>;
    if (parsed?.error?.code && parsed.error.message) return parsed.error;
  } catch {
    // fall through
  }
  return {
    code: response.status === 401 ? 'unauthenticated' : 'internal',
    message: `The board returned ${response.status}.`,
  };
}
