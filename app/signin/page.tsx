import { redirect } from "next/navigation";
import { SignInForm } from "@/app/signin/signin-form";
import { DEFAULT_SIGNED_IN_PATH, sanitizeReturnTo } from "@/lib/auth-redirect";
import { getCurrentUser } from "@/lib/auth-helpers";

export const metadata = { title: "Sign in — Arbini Family" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { redirect: requested } = await searchParams;

  // Re-sanitized here even though middleware built the link, because this value arrives in a URL
  // anyone can type. `sanitizeReturnTo` is what stops `?redirect=//evil.example` turning the
  // sign-in page into an open redirect.
  const returnTo = sanitizeReturnTo(requested) ?? DEFAULT_SIGNED_IN_PATH;

  // Nothing to do here if they already have a session — bounce them where they were going.
  const user = await getCurrentUser();
  if (user) redirect(returnTo);

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="font-display text-center text-5xl leading-none sm:text-6xl">
          Arbini Family
        </h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          For the five of us.
        </p>
        <SignInForm returnTo={returnTo} />
      </div>
    </main>
  );
}
