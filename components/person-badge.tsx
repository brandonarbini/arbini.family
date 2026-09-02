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
 * Mid-tone on purpose. The board renders on both a white and a near-black card, so a palette
 * anchored at either end would leave some avatars washed out in one theme.
 */
const FAMILY_PALETTE = ["#b4541f", "#e8a33d", "#d9c5a0", "#3d5a5b", "#8c4a6b"];

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
