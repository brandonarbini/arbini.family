import Avatar from "boring-avatars";
import { cn } from "@/lib/utils";

/**
 * A person's avatar: a Boring Avatars "beam", generated from their name.
 *
 * Rendered by the `boring-avatars` package rather than fetched from
 * `boringavatars.com/beam/...`. The output is the same SVG, but the hosted form would put each
 * family member's name in a URL sent to a third party on every page load — which sits badly with
 * an app that is otherwise noindex and behind an allowlist. Local generation also means no
 * network round trip, nothing to fail offline, and no layout shift while an image loads.
 *
 * Deterministic from the name: the same person gets the same face on every device, forever,
 * without anybody uploading a photo. That is also why this takes no colour — identity comes from
 * the name, so `Profile.color` is no longer read here.
 */

/**
 * One palette for the whole family, which is how these are meant to be used: the *name* is what
 * makes each avatar distinct, so a shared set of colours leaves the five of them looking like one
 * family rather than five unrelated stickers.
 *
 * Two properties this list is built around, both of them consequences of how the library actually
 * works (`u(hash + t, colors, len)` in boring-avatars):
 *
 * 1. **Adjacent entries always appear together.** A beam takes its background from
 *    `colors[hash % len]` and its hair from the very next index. So neighbours here must contrast
 *    with each other — hue variety alone is not enough if two similar colours happen to sit side
 *    by side. Every consecutive pair, including the wrap from last to first, is a strong contrast.
 *
 * 2. **Nine entries, not five.** The background index is `hash % len`, so with five colours and
 *    five people the hashes collide: Brandon, Jill and Tanner all landed on the same gold. Nine is
 *    the shortest length at which all five of the current names come out distinct.
 *
 * That second point is tuned to the names in `prisma/seed.ts` — rename somebody and the
 * assignment reshuffles, possibly onto a shared background. Nothing breaks if that happens, and
 * the first property still holds for any name, so this is a nicety rather than an invariant.
 */
const FAMILY_PALETTE = [
  // Strictly alternating dark and light, because a beam takes its background and its hair from
  // neighbouring indices — two darks side by side would produce an avatar with no internal
  // contrast. Nine entries so all five current names land on distinct backgrounds.
  "#1c1917", // ink
  "#f2ede1", // paper
  "#b3271e", // press red
  "#e6dfd0", // paper, warmer
  "#443c35", // ink, lifted
  "#d9d0bd", // paper, deeper
  "#8c1f18", // press red, deeper
  "#efe8da", // paper, palest
  "#a89a86", // tan
];

export function PersonBadge({
  name,
  size = 44,
  className,
}: {
  name: string;
  /** Pixel size. The board leads with these, so they are deliberately large. */
  size?: number;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex shrink-0", className)}>
      <Avatar
        name={name}
        variant="beam"
        size={size}
        colors={FAMILY_PALETTE}
        // The name is already rendered as text beside every one of these, so announcing it again
        // would just make a screen reader say it twice.
        title={false}
      />
    </span>
  );
}
