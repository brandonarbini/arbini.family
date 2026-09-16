---
name: expo-mobile-app
description: >-
  Use before running any command under `mobile/`, the Expo app — it is the one part of this
  repository that runs on the **host**, not in the devcontainer, so the repo-wide
  `devcontainer exec` rule is inverted here. Load when starting Metro or the iOS Simulator, when
  editing `mobile/package.json`, `mobile/pnpm-workspace.yaml` or `mobile/pnpm-lock.yaml`, when
  adding a dependency to the app, and before any `pnpm install` anywhere in this repository.
  Symptoms: `next dev`, `prisma` or `vitest` breaking in the container right after an install ran
  on the host; pnpm resolving out of `mobile/` into the root workspace and rewriting the root
  lockfile; Metro bound to a port nothing can reach; a request to "add `mobile` to the workspace"
  or to delete its empty `pnpm-workspace.yaml`.
---

## `mobile/` runs on the host

Metro, the iOS Simulator and Xcode cannot work from inside the Linux container, and the container
publishes no port that Metro could use: the `app` service shares the `db` service's network
namespace, so every port is fixed at container creation from a hashed base. So `mobile/` is the
exception to this repository's `devcontainer exec --workspace-folder .` rule — its commands run
from `mobile/`, on the host:

```bash
cd mobile
pnpm install     # stays local; the empty workspace root stops pnpm walking up
pnpm start       # Metro
pnpm ios         # Metro + iOS Simulator
pnpm lint
```

## It is deliberately not a workspace member

`mobile/` carries its own `pnpm-workspace.yaml` — an empty workspace root — and its own
`pnpm-lock.yaml` and `node_modules`.

**Never run `pnpm install` at the repository root from the host.** The container bind-mounts this
directory, so the two share one `node_modules`; a host install re-resolves every platform-specific
package for macOS and replaces the container's Linux binaries, which breaks `next dev`, `prisma`
and `vitest` until a container-side `pnpm install` puts them back.

The empty workspace root in `mobile/pnpm-workspace.yaml` exists to make that mistake unreachable
from inside `mobile/`: without it, pnpm walks up, finds the root workspace, and installs the whole
repository from the host. Do not delete it, and do not add `mobile` to the root
`pnpm-workspace.yaml` — the two lockfiles are the point, not an oversight.
