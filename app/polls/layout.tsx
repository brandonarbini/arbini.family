import { AppShell } from "@/components/app-shell";
import { requireAuth } from "@/lib/auth-helpers";

/**
 * Polls sit behind the same chrome as the board.
 *
 * `requireAuth` here and `requireProfile` in the pages: the layout only needs a name for the
 * colophon, while answering needs a profile to answer *as*. Both redirect through sign-in and
 * back, which is what makes a link pasted into the family chat work for somebody who is signed
 * out — they land on the ballot, not on the board.
 */
export default async function PollsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAuth("/polls");
  return <AppShell userName={user.name}>{children}</AppShell>;
}
