"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

/**
 * Light/dark switch, sized for the footer colophon.
 *
 * Both icons are always rendered and CSS picks one, rather than the usual `mounted` flag that
 * returns a placeholder until the client knows the theme. The server genuinely cannot know which
 * icon is right — the answer is in localStorage and the system preference — but it does not need
 * to: `next-themes` puts the `.dark` class on <html> before paint, so the `dark:` variants resolve
 * on the very first frame with no state, no effect, and no swap from sun to moon after hydration.
 *
 * Toggles between light and dark rather than cycling through "system". A three-way cycle is hard
 * to convey in one control, and the provider still *starts* on the system preference — this only
 * takes over once somebody expresses an opinion.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <button
      type="button"
      className="inline-flex items-center hover:text-foreground"
      // `resolvedTheme` is undefined until hydration, but a click cannot happen before then, so
      // it is always known by the time this runs.
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      aria-label="Toggle dark mode"
      title="Toggle dark mode"
    >
      <Sun className="hidden size-3.5 dark:block" aria-hidden />
      <Moon className="block size-3.5 dark:hidden" aria-hidden />
    </button>
  );
}
