<!-- BEGIN dev-env:environment -->

## Development environment

This project runs in a devcontainer mounted at `/workspace`. Run build, test, lint, package, and database commands with `devcontainer exec --workspace-folder . <command>`. If the container is stopped, start it with `devcontainer up --workspace-folder .`.

<!-- END dev-env:environment -->

## Exception: the `mobile/` Expo app

`mobile/` is the one part of this repository that runs on the **host**, not in the devcontainer.
Metro, the iOS Simulator and Xcode cannot work from inside the Linux container, and the container
publishes no port that Metro could use (the `app` service shares the `db` service's network
namespace, so every port is fixed at container creation from a hashed base).

It is deliberately **not** a pnpm workspace member. It carries its own `pnpm-workspace.yaml` — an
empty workspace root — and its own `pnpm-lock.yaml` and `node_modules`. Run its commands from
`mobile/`, on the host:

```bash
cd mobile
pnpm install     # stays local; the empty workspace root stops pnpm walking up
pnpm start       # Metro
pnpm ios         # Metro + iOS Simulator
pnpm lint
```

**Never run `pnpm install` at the repository root from the host.** The container bind-mounts this
directory, so the two share one `node_modules`; a host install re-resolves every platform-specific
package for macOS and replaces the container's Linux binaries, which breaks `next dev`, `prisma`
and `vitest` until a container-side `pnpm install` puts them back. The empty workspace root in
`mobile/pnpm-workspace.yaml` exists to make that mistake unreachable from inside `mobile/` — do not
delete it.
