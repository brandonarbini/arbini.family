import { getPasskeys } from "@/app/account/data";
import {
  AddPasskeyButton,
  RemovePasskeyButton,
} from "@/app/account/passkey-controls";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAuth } from "@/lib/auth-helpers";

export const metadata = { title: "Account — arbini.family" };

export default async function AccountPage() {
  const user = await requireAuth("/account");
  const passkeys = await getPasskeys(user.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl">{user.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Passkeys</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            A passkey signs you in with your face, fingerprint or device PIN, so
            you stop needing the email link. Add one per device.
          </p>

          {passkeys.length > 0 ? (
            <ul className="divide-y">
              {passkeys.map((passkey) => (
                <li
                  key={passkey.id}
                  className="flex items-center gap-3 py-2 first:pt-0"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {passkey.name ?? "Passkey"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {passkey.deviceType === "singleDevice"
                        ? "This device only"
                        : "Synced across your devices"}
                    </p>
                  </div>
                  <div className="ml-auto">
                    <RemovePasskeyButton passkeyId={passkey.id} />
                  </div>
                </li>
              ))}
            </ul>
          ) : null}

          <AddPasskeyButton />
        </CardContent>
      </Card>
    </div>
  );
}
