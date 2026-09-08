# Arbini Family — mobile

The Expo app for the family board. Reads and writes the web app's `/api/v1/*` surface, shares its
Better Auth session, and signs in with a magic link or a passkey.

## This app runs on the host

Unlike the rest of the repository, `mobile/` is **not** developed inside the devcontainer. Metro,
the iOS Simulator and Xcode cannot work from the Linux container, and the container publishes no
port Metro could use — the `app` service shares the `db` service's network namespace, so ports are
fixed at container creation from a hashed base.

It is also not a pnpm workspace member. It carries its own `pnpm-workspace.yaml` — an empty
workspace root — plus its own `pnpm-lock.yaml` and `node_modules`.

```bash
cd mobile
pnpm install     # stays local; the empty workspace root stops pnpm walking up
pnpm ios         # Metro + iOS Simulator
pnpm start       # Metro only
pnpm typecheck
pnpm lint
pnpm format
```

> **Never run `pnpm install` at the repository root from the host.** The container bind-mounts this
> directory, so both share one `node_modules`. A host install re-resolves every platform-specific
> package for macOS and replaces the container's Linux binaries, breaking `next dev`, `prisma` and
> `vitest` until a container-side `pnpm install` restores them. Recover with:
>
> ```bash
> devcontainer exec --workspace-folder . pnpm install --frozen-lockfile
> ```
>
> The empty workspace root in `pnpm-workspace.yaml` exists to make that unreachable from inside
> `mobile/`. Do not delete it.

The web app, database and tests stay in the container, from the repository root:
`devcontainer exec --workspace-folder . <command>`.

## Which server it talks to

`EXPO_PUBLIC_API_URL`, read through `src/lib/env.ts`. Dev points at dev, a release build points at
production — nothing in the source names an environment.

```bash
cp .env.example .env.local     # then set the port for your worktree
```

`.env.local` is gitignored and there is deliberately **no committed default**. In local development
the value is the devcontainer's published app port, and that port is derived from a hash of the
worktree path, so it differs per worktree and per machine. A committed default would be correct for
exactly one checkout. Find yours from the repository root with
`grep PORT .devcontainer/docker-compose.worktree.yml`.

No web-side configuration is needed to match: `resolveBaseUrl()` in `lib/urls.ts` already falls
back to `http://localhost:${PORT}`, and the container sets `PORT`. The two agree by construction.

The value must match that server's origin **exactly** — Better Auth pins its `baseURL` from the
same value and checks `Origin` against it, so a trailing slash, or `127.0.0.1` for `localhost`,
surfaces as an opaque auth rejection rather than a connection error.

Production is not in any `.env` file. The `preview` and `production` profiles in `eas.json` carry
`EXPO_PUBLIC_API_URL=https://arbini.family`, so a shipped binary cannot pick up a developer's
localhost by accident. `development` deliberately carries none and falls through to `.env.local`,
because the right value there is per-worktree.

A physical device is the one awkward case for _local_ work: it can't reach `localhost`, so it needs
the Mac's LAN IP here _and_ `APP_URL` set to the same address in the repository root's `.env.local`,
so the server's own origin agrees. Building against production sidesteps that entirely — see
[Builds](#builds).

## Layout

```
src/app/            Expo Router routes
  _layout.tsx         root Stack + AuthGate — a Stack, not the tabs, so sign-in lives outside them
  sign-in.tsx         magic link, plus a passkey button when the binary can offer one
  auth.tsx            the arbinifamily:// deep-link landing, which writes the session cookie
  (tabs)/             Board, Where I am, Polls, Account
  stay/               new + [id], both presented as form sheets
src/components/     Section / RuledList / Copy / DateStamp — the newspaper primitives
                    Page — masthead and paper ground, the native counterpart of app-shell.tsx
src/constants/      theme.ts — tokens ported from the web's globals.css
src/lib/            api.ts + queries.ts (the /api/v1 client), auth-client.ts, env.ts
src/hooks/          color scheme + theme
assets/             wordmark.svg + mark.svg, and the PNGs generated from them
scripts/            build-assets.mjs
```

## Design

The tokens in `src/constants/theme.ts` are converted from the oklch values in the web app's
`app/globals.css` — warm paper ground, square corners, rules drawn in ink rather than a grey chosen
to disappear.

Neither Typekit face comes across, because Adobe Fonts does not licence embedding a font in an app
binary. They are handled differently:

- **Luke** (the wordmark) is drawn as an outlined SVG — `assets/wordmark.svg`, rendered by
  `src/components/wordmark.tsx`. Outlines are artwork, not an embedded font, so no app licence is
  needed.
- **P22 Stickley** (headlines) falls back to the platform serif, New York on iOS.

If the wordmark is ever re-exported, two properties have to hold or it breaks quietly rather than
loudly:

- **`fill="currentColor"` on every path, no hard-coded colour.** That is what lets one asset be ink
  on paper and paper on ink; the component supplies the value through `color`. Illustrator exports
  a literal hex (`#231f20` last time) and it has to be rewritten.
- **A tight `viewBox` and no `width`/`height` attributes**, with `WORDMARK_ASPECT_RATIO` in
  `wordmark.tsx` kept in step with it. A mismatch shows up as a subtly squashed wordmark, not an
  error.

### Icons and the splash

Every PNG in `assets/images/` is generated, not drawn:

```bash
node scripts/build-assets.mjs     # needs ImageMagick: brew install imagemagick
```

It reads two vectors and writes nine rasters. `assets/wordmark.svg` becomes the splash;
`assets/mark.svg` — the wordmark's initial `A`, the same path data lifted out — becomes the app
icon, the Android adaptive layers and the web favicon. **Commit the PNGs**: Expo reads the rasters,
so the vectors alone are not enough.

Deriving them buys one thing worth the script. A colour is a token in one place rather than nine
files that drift, and the icon is provably the same letterform as the masthead instead of an
approximation of it.

Two details that are choices rather than defaults:

- `ios.icon` is the `{ light, dark, tinted }` triple, replacing the Expo template's `.icon` bundle
  (an Icon Composer document, which needs Icon Composer to edit). Plain PNGs get the same iOS 26
  appearance modes and stay editable from here.
- The mark is inset to 62% of the icon square, and only 45% of the Android foreground — Android's
  adaptive icon crops to a shape the launcher picks and clips anything outside the middle 66%. That
  is a safe zone, not a margin.

Standalone rules are drawn as a filled `View` with a `height`, never as a `borderTopWidth`. A
border on a view with no intrinsic height silently fails to paint once the width goes sub-pixel,
which is how the hairline half of the masthead's Scotch rule went missing the first time.

## Builds

```bash
pnpm ios          # debug build + Metro, on the Simulator
```

That is the loop for everything except passkeys, which the Simulator cannot do at all.

### Development builds, and why `expo-dev-client` is here

A debug build made this way bakes in the address of the Metro server that built it, so pointing the
app at a different machine means compiling again. `expo-dev-client` replaces that with a launcher:
the app boots into a chooser, and you hand it whichever bundle URL you want. Same native binary,
different JavaScript.

The distinction that matters is which half you changed. Native code, entitlements, `app.json`, a new
module — all of that needs a rebuild. Everything in `src/` does not, and on this app most of the work
is in `src/`. It is worth knowing which kind of change you just made before waiting five minutes for
a compile that changed nothing native.

The launcher and dev menu are compiled into debug builds only, so a release build carries neither.
Installing it also settles two smaller things: `eas.json`'s `development` profile sets
`developmentClient: true` and had nothing to back it, and EAS warns on production builds when the
package is absent —

> Detected that your app uses Expo Go for development, this is not recommended when building
> production apps.

— which was never true here. That warning fires when the profile is named `production`,
`expo-dev-client` is missing, and there is no committed native directory; `ios/` is generated by
prebuild and gitignored, so the last condition holds for a project that has never once opened Expo
Go. The app cannot even run there: Expo Go ships a fixed set of native modules, and
`react-native-passkeys` and `webcredentials:arbini.family` are not among them.

### On a physical iPhone, against production

The only way to test passkeys, and the only way to hand the app to someone.

```bash
EXPO_PUBLIC_API_URL=https://arbini.family \
  npx expo run:ios --device --configuration Release
```

Both halves of that line are deliberate:

- **`--configuration Release`** bundles the JavaScript into the binary. A debug build needs Metro
  reachable on the same network to render anything, so it stops working the moment you walk away
  from the Mac — which is most of what you want to try on a real phone.
- **The variable inline**, rather than in `.env.local`. A real environment variable takes precedence
  over `.env` files, so this points one build at production without leaving a production URL behind
  to confuse the next `pnpm start` against the devcontainer.

The phone needs Developer Mode on (Settings → Privacy & Security → Developer Mode; it reboots) and
an Apple Developer account signed in under Xcode → Settings → Accounts.

### EAS

`eas.json` holds three profiles — `development`, `preview`, `production` — and is inert until the
project is linked, since `app.json` carries no `extra.eas.projectId`:

```bash
npx eas-cli@latest init
npx eas-cli@latest build --platform ios --profile preview
```

`eas-cli` is not a dependency on purpose; Expo's own guidance is to run it through `npx` so the
version tracks the service rather than the lockfile.

## Passkeys and the associated domain

`app.config.ts` declares `webcredentials:arbini.family`, unconditionally. It was once gated behind
an `EXPO_APPLE_TEAM_ID` variable so the app could be built with no Apple account; that gate is gone,
because the variable lived in a gitignored file and a fresh clone would have quietly built an app
with no associated domain and no passkeys.

`com.apple.developer.associated-domains` is a capability, so Xcode will not build a target carrying
it without a provisioning profile that grants it — and that requirement ignores the destination.
Without a signing certificate, `npx expo run:ios` fails with `No code signing certificates are
available to use` **even for a simulator build**, which reads as a broken toolchain rather than the
missing account it is. Create one under Xcode → Settings → Accounts → Manage Certificates → + →
Apple Development.

The domain must equal `rpID` on the server — the hostname of `resolveBaseUrl()` — and it must serve
`/.well-known/apple-app-site-association`, which `APPLE_TEAM_ID` on the server populates.

**When this is wrong, nothing says so.** Apple's platform reports no error for an association it
could not resolve; the passkey sheet simply never appears, or appears and finds nothing. Two things
to check before the code, in order:

```bash
codesign -d --entitlements - /path/to/Arbini\ Family.app     # is the entitlement in the binary?
curl https://app-site-association.cdn-apple.com/a/v1/arbini.family
```

The second is Apple's CDN copy, cached independently of your deploy — so it can lag a fix by a
while, and a correct document on your own origin proves less than it looks like it does.
