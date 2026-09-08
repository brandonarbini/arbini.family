import "server-only";

import { createHash } from "node:crypto";

import { beamSvg } from "@/lib/avatars/beam";

/**
 * Where a client should fetch a person's avatar, and how it knows the one it cached is stale.
 *
 * `expo-image` keys its disk cache on the URL and makes no promise about revalidating it — the
 * Expo docs describe `cachePolicy` as *where* an image is kept, never as a freshness strategy, and
 * on iOS the underlying cache does not re-ask the server at all. So a URL that never changes is a
 * face that never changes, which would quietly undo the reason `/api/v1/avatars` exists: a
 * restyle, or a real photograph, is supposed to be a deploy rather than a rebuild, and it is only
 * that if the phone can tell that what it is holding is out of date.
 *
 * Hence the version: the content hash of the avatar itself. Not of the *name* — the name is only
 * one of the things that decides what a person looks like, and hashing it would miss a change to
 * the palette, to the generator, or to a photograph somebody uploaded under an unchanged name.
 * Hashing what is actually served cannot miss any of them.
 */
export function avatarPath(profileId: string, name: string): string {
  return `/api/v1/avatars/${profileId}?v=${avatarHash(beamSvg(name))}`;
}

/**
 * The hash, over the exact bytes the endpoint sends.
 *
 * Shared with the route on purpose: the version in the URL and the ETag on the response are the
 * same claim about the same bytes, and computing them two ways is how they would come to disagree.
 */
export function avatarHash(svg: string): string {
  return createHash("sha1").update(svg).digest("base64url");
}
