import { AppShell } from "@/components/app-shell";
import { requireAuth } from "@/lib/auth-helpers";

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAuth("/account");
  return <AppShell userName={user.name}>{children}</AppShell>;
}
