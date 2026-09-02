import { AppShell } from "@/components/app-shell";
import { requireAuth } from "@/lib/auth-helpers";

/**
 * `requireAuth` runs here as well as in each page. The middleware's cookie check is optimistic and
 * never validates the session, so this is the first place a forged or expired cookie is actually
 * rejected — and the pages repeat it because Next does not guarantee a layout re-runs on every
 * nested navigation.
 */
export default async function HomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAuth();
  return <AppShell userName={user.name}>{children}</AppShell>;
}
