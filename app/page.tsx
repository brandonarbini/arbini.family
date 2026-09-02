import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth-helpers";

/**
 * The public front door. Deliberately almost empty: everything this site does is behind sign-in,
 * and a landing page that described the contents would be describing a private family's
 * whereabouts to anyone who found the domain.
 */
export default async function LandingPage() {
  const user = await getCurrentUser();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-6">
      <h1 className="font-display text-3xl">arbini.family</h1>
      <Button asChild>
        <Link href={user ? "/home" : "/signin"}>
          {user ? "Go to the board" : "Sign in"}
        </Link>
      </Button>
    </main>
  );
}
