import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";

/**
 * The signed-in chrome, shared by every authenticated route.
 *
 * A component rather than a shared parent layout: `/home` and `/account` are siblings at the
 * route root, and grouping them under one segment would mean either changing both URLs or adding
 * a route group whose only job is to hold this markup.
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
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-6 py-3">
          <Link href="/home" className="font-display text-base">
            arbini.family
          </Link>
          <nav className="flex items-center gap-1 text-sm text-muted-foreground">
            <Link
              href="/home/where"
              className="rounded px-2 py-1 hover:bg-accent"
            >
              Where I am
            </Link>
            <Link href="/account" className="rounded px-2 py-1 hover:bg-accent">
              Account
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {userName}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-8">{children}</main>
    </div>
  );
}
