import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { formatCalendarDate, todayInFamilyTz } from "@/lib/dates";

/**
 * The signed-in chrome, shared by every authenticated route.
 *
 * A component rather than a shared parent layout: `/home` and `/account` are siblings at the
 * route root, and grouping them under one segment would mean either changing both URLs or adding
 * a route group whose only job is to hold this markup.
 *
 * Laid out as a nameplate. The family's name centred and set large in the blackletter, a Scotch
 * rule beneath it — one heavy line over one hairline — then the dateline, then the links. That
 * stack is the one piece of newspaper furniture everyone recognises without being told what it is
 * imitating, and it costs a handful of divs.
 */
export function AppShell({
  userName,
  children,
}: {
  userName: string;
  children: React.ReactNode;
}) {
  // Read here rather than passed in. The shell is already dynamic because it renders behind auth,
  // and this is the same "today" the board reckons against — resolved by the same helper in the
  // family's timezone, so the dateline and the countdown can never disagree about the date.
  const today = todayInFamilyTz();

  return (
    <div className="relative z-10 min-h-screen">
      <header className="mx-auto max-w-3xl px-6 pt-10">
        <Link
          href="/home"
          className="font-logo block text-center text-5xl leading-none sm:text-6xl"
        >
          Arbini Family
        </Link>

        <div className="mt-5 border-t-2 border-foreground" aria-hidden />
        <div className="mt-[3px] border-t border-foreground" aria-hidden />

        <p className="mt-3 text-center text-[0.6875rem] uppercase tracking-[0.2em] text-muted-foreground">
          {formatCalendarDate(today, "EEEE d MMMM yyyy")}
        </p>

        {/*
          `flex-wrap` rather than a fixed row: five items at this size overflow a narrow phone, and
          wrapping to a second centred line degrades better than a horizontal scroll or hidden
          links.
        */}
        <nav className="mt-4 flex flex-wrap items-center justify-center gap-x-1 gap-y-1 text-sm">
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

        <div className="mt-4 border-t border-foreground" aria-hidden />
      </header>

      <main className="mx-auto max-w-3xl px-6 pb-16 pt-10">{children}</main>
    </div>
  );
}

function NavLink({ href, children }: { href: string; children: string }) {
  return (
    <Link
      href={href}
      className="px-2 py-1 text-muted-foreground hover:text-foreground hover:underline hover:underline-offset-4"
    >
      {children}
    </Link>
  );
}
