"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={async () => {
        await authClient.signOut();
        // `refresh` as well as `push`: without it the server components for `/` may be served
        // from the router cache still holding the signed-in render.
        router.push("/");
        router.refresh();
      }}
    >
      <LogOut aria-hidden />
      Sign out
    </Button>
  );
}
