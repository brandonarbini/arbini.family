# Arbini Family — mobile

The Expo app for the family board. Currently a read-only board and stay list, rendering from
fixtures in `src/constants/fixtures.ts`; the API it will read does not exist yet.

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

Production is not configured in any file here; a release build takes the value from its EAS build
profile, so a shipped binary cannot carry a developer's localhost. A physical device is the one
awkward case: it can't reach `localhost`, so it needs the Mac's LAN IP here _and_ `APP_URL` set to
the same address in the repository root's `.env.local`, so the server's own origin agrees.

## Layout

```
src/app/            Expo Router routes
  _layout.tsx         root Stack — a Stack, not the tabs, so sign-in can live outside them
  (tabs)/             Board and Where I am
src/components/     Section / RuledList / Copy / DateStamp — the newspaper primitives
                    Page — masthead and paper ground, the native counterpart of app-shell.tsx
src/constants/      theme.ts (tokens ported from the web's globals.css), fixtures.ts
src/hooks/          color scheme + theme
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

Standalone rules are drawn as a filled `View` with a `height`, never as a `borderTopWidth`. A
border on a view with no intrinsic height silently fails to paint once the width goes sub-pixel,
which is how the hairline half of the masthead's Scotch rule went missing the first time.
