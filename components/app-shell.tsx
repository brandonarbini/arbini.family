import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";

/**
 * The signed-in chrome, shared by every authenticated route.
 *
 * A component rather than a shared parent layout: `/home` and `/account` are siblings at the
 * route root, and grouping them under one segment would mean either changing both URLs or adding
 * a route group whose only job is to hold this markup.
 *
 * The masthead is centred and set large in the display face — this is a family's own site, not a
 * tool, and it can afford to say whose it is before it says what it does. Navigation sits under
 * it rather than beside it, so the title keeps the full width and the links read as one row
 * rather than as something competing with the name.
 */
export function AppShell({
  userName,
  children,
}: {
  userName: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <header className="border-b">
        <div className="mx-auto max-w-3xl px-6 py-8">
          <Link
            href="/home"
            className="font-display block text-center text-5xl leading-none sm:text-6xl"
          >
            Arbini Family
          </Link>

          {/*
            `flex-wrap` rather than a fixed row: five items at this size overflow a narrow phone,
            and wrapping to a second centred line degrades better than a horizontal scroll or
            hidden links.
          */}
          <nav className="mt-5 flex flex-wrap items-center justify-center gap-x-1 gap-y-1 text-sm">
            <NavLink href="/home">Board</NavLink>
            <NavLink href="/home/where">Where I am</NavLink>
            <NavLink href="/account">Account</NavLink>
            <span
              className="mx-2 hidden h-4 w-px bg-border sm:block"
              aria-hidden
            />
            <span className="px-2 text-muted-foreground">{userName}</span>
            <SignOutButton />
            <ThemeToggle />
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-8">{children}</main>
    </div>
  );
}

function NavLink({ href, children }: { href: string; children: string }) {
  return (
    <Link
      href={href}
      className="rounded px-2 py-1 text-muted-foreground hover:bg-accent hover:text-foreground"
    >
      {children}
    </Link>
  );
}
