import { requireProfileActor } from "@/lib/api/guard";
import { apiError } from "@/lib/api/http";
import { beamSvg } from "@/lib/avatars/beam";
import { avatarHash } from "@/lib/avatars/path";
import { getFamilyMembers } from "@/lib/board/data";

/**
 * One person's avatar, as an image.
 *
 * This is the answer to "what does this person look like", and it is deliberately a URL rather
 * than a rule each client applies for itself. The web draws it inline from `lib/avatars/beam.ts`,
 * during a render it is already doing; the Expo app cannot draw it at all, and porting the
 * generator into the app would freeze the answer into a shipped binary — restyling the avatars,
 * or letting somebody upload an actual photograph, would then be wrong on every installed phone
 * until it was rebuilt. Behind a URL, both are a deploy.
 *
 * Keyed on `profileId`, not name. A name is a fine *seed* for a generated face — it is what
 * `beamSvg` hashes — but it is not an identity, and the day this serves a photograph the
 * photograph will belong to a person, not to a spelling.
 */
type Context = { params: Promise<{ profileId: string }> };

export async function GET(
  request: Request,
  context: Context,
): Promise<Response> {
  const actor = await requireProfileActor();
  if (!actor.ok) return actor.response;

  const { profileId } = await context.params;

  // The roster is a cached read, so this costs nothing per avatar; five of these land at once on
  // every board render.
  const members = await getFamilyMembers();
  const member = members.find((person) => person.profileId === profileId);
  if (!member) {
    return apiError("not_found", "Nobody on the board has that id.");
  }

  const svg = beamSvg(member.name);
  const etag = `"${avatarHash(svg)}"`;

  // `?v=` is not read. It is the client's cache key, not an argument — `avatarPath` puts the
  // content hash there so a changed avatar arrives at a URL the phone has never seen, and this
  // handler's only job is to answer for the person named in the path.
  const versioned = new URL(request.url).searchParams.has("v");

  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, {
      status: 304,
      headers: cacheHeaders(etag, versioned),
    });
  }

  // Not `jsonOk`, which is JSON-only and sends `no-store`. This response is an image: it is worth
  // caching, and unlike the rest of `/api/v1` it does not go stale the moment somebody moves.
  return new Response(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      ...cacheHeaders(etag, versioned),
    },
  });
}

/**
 * `private` because this is a family member's face. It is a generated one today, so the secret it
 * protects is nothing much — but the moment this serves an uploaded photograph, a shared cache
 * holding one would be a mistake made a year earlier and noticed never.
 *
 * A versioned URL is content-addressed, so it can be kept forever: if the avatar changes, the URL
 * changes with it. An unversioned one is the same URL for every version of a face there will ever
 * be — that is what a client built before `avatarPath` existed asks for — so it gets an hour, and
 * the ETag to revalidate against.
 */
function cacheHeaders(
  etag: string,
  versioned: boolean,
): Record<string, string> {
  return {
    "Cache-Control": versioned
      ? "private, max-age=31536000, immutable"
      : "private, max-age=3600",
    ETag: etag,
  };
}
