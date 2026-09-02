import { cn } from "@/lib/utils";

/**
 * A person's initials in their own accent colour.
 *
 * Initials rather than photographs: nobody is going to upload five avatars, and an empty photo
 * slot looks broken in a way a monogram does not.
 */
export function PersonBadge({
  name,
  color,
  className,
}: {
  name: string;
  color: string | null;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-medium",
        color ? "text-white" : "bg-secondary text-secondary-foreground",
        className,
      )}
      style={color ? { backgroundColor: color } : undefined}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
