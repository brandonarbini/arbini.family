import { getPasskeys } from "@/app/account/data";
import {
  AddPasskeyButton,
  RemovePasskeyButton,
} from "@/app/account/passkey-controls";
import { RuledList, Section } from "@/components/ui/section";
import { requireAuth } from "@/lib/auth-helpers";

export const metadata = { title: "Account — Arbini Family" };

export default async function AccountPage() {
  const user = await requireAuth("/account");
  const passkeys = await getPasskeys(user.id);

  return (
    <div>
      <div className="mb-10">
        <h1 className="font-headline text-4xl">{user.name}</h1>
        <p className="font-copy mt-2 text-base text-muted-foreground">
          {user.email}
        </p>
      </div>

      <Section title="Passkeys">
        <div className="space-y-4">
          <p className="font-copy text-base text-muted-foreground">
            A passkey signs you in with your face, fingerprint or device PIN, so
            you stop needing the email link. Add one per device.
          </p>

          {passkeys.length > 0 ? (
            <RuledList>
              {passkeys.map((passkey) => (
                <li
                  key={passkey.id}
                  className="flex items-center gap-3 py-3 first:pt-0"
                >
                  <div>
                    <p className="font-copy text-base font-semibold">
                      {passkey.name ?? "Passkey"}
                    </p>
                    <p className="font-copy text-base text-muted-foreground">
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
            </RuledList>
          ) : null}

          <AddPasskeyButton />
        </div>
      </Section>
    </div>
  );
}
