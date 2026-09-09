import { cn } from "@/lib/utils";

/**
 * A page still loading, drawn the way the page will be drawn.
 *
 * The skeletons were rounded, filled, shadowless blocks — which is to say **cards**, the one thing
 * `components/ui/section.tsx` was written to remove. Under the masthead you got a nameplate over
 * three grey pills, so the loading state did not resemble the real thing; it resembled the version
 * this design replaced.
 *
 * These draw the actual furniture instead: a letterspaced head, the real Scotch rule, and bars at
 * copy width. Square, because everything here is square.
 */
export function SkeletonSection({
  lines = 3,
  className,
}: {
  /** Roughly how much content the real section has, so the page does not lurch when it arrives. */
  lines?: number;
  className?: string;
}) {
  return (
    <section className={cn("mb-12 animate-pulse", className)} aria-hidden>
      <div className="h-2.5 w-28 bg-muted" />
      <div className="mt-2 border-t-2 border-muted" />
      <div className="space-y-2.5 pt-4">
        {Array.from({ length: lines }, (_, index) => (
          <div
            key={index}
            className="h-4 bg-muted"
            // Ragged, like set copy. A stack of identical full-width bars reads as a table.
            style={{ width: `${[92, 76, 84, 61, 88][index % 5]}%` }}
          />
        ))}
      </div>
    </section>
  );
}
