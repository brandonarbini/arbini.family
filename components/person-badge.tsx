import { beamSvg } from "@/lib/avatars/beam";
import { cn } from "@/lib/utils";

/**
 * A person's avatar on the web.
 *
 * Inline markup rather than an `<img>` pointed at `/api/v1/avatars/{profileId}`, which is where the
 * Expo app gets the same picture. The web can draw it during the render it is already doing, so a
 * request per avatar would buy nothing and cost a flash of empty boxes on first paint. Both read
 * `lib/avatars/beam.ts`, so the two clients cannot drift about what a person looks like.
 */
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
    <span
      className={cn("inline-flex shrink-0", className)}
      // Not user content. `beamSvg` writes a fixed shape from a fixed template; the name reaches
      // it only as the seed for a hash, and never appears in the output — the avatar carries no
      // <title>, because the name is already rendered as text beside every one of these.
      dangerouslySetInnerHTML={{ __html: beamSvg(name, size) }}
    />
  );
}
