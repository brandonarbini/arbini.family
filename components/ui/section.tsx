import { cn } from "@/lib/utils";

/**
 * A section of the page, set the way a newspaper sets one: a letterspaced head, a heavy rule
 * under it, then the content — no box, no fill, no shadow.
 *
 * This replaces the Card the board used to be built from. A bordered container is the single
 * loudest "application" signal in a layout; print separates by rule and whitespace instead, and
 * gets the same grouping with a fraction of the ink.
 *
 * The head is set in the sans rather than the headline serif. At this size and letterspacing a
 * serif's detail turns to noise, and keeping the furniture in one voice leaves the serif to mean
 * "this is a headline".
 */
export function Section({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("mb-12", className)}>
      <h2 className="text-[0.6875rem] font-medium uppercase tracking-[0.2em] text-muted-foreground">
        {title}
      </h2>
      {/* The heavy half of a Scotch rule. Weight is what makes a rule read as structure. */}
      <div className="mt-2 border-t-2 border-foreground" aria-hidden />
      <div className="pt-4">{children}</div>
    </section>
  );
}

/**
 * Rows divided by hairlines rather than wrapped in a container — the list equivalent of the same
 * idea. `last:border-0` keeps the section from ending on a rule, which would read as a second,
 * weaker section break.
 */
export function RuledList({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <ul className={cn("divide-y divide-border", className)}>{children}</ul>
  );
}
