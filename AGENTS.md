# arbini.family

A private Next.js 16 App Router app for one family — not a multi-tenant product, so there is no
organization or tenant concept anywhere. The home page is "the board": a fortnight agenda,
birthdays, who's around, and polls awaiting an answer. Postgres through Prisma 7 driver adapters
(`@/generated/prisma/client`), Better Auth for magic-link and passkey sign-in gated on the
`FAMILY_EMAILS` allowlist, Cache Components on. `mobile/` is a companion Expo app.

<!-- BEGIN dev-env:environment -->

## Development environment

This project runs in a devcontainer mounted at `/workspace`. Run build, test, lint, package, and database commands with `devcontainer exec --workspace-folder . <command>`. If the container is stopped, start it with `devcontainer up --workspace-folder .`.

<!-- END dev-env:environment -->

`git` and `gh` run on the **host**, never in the container. So does everything under `mobile/` —
see the `expo-mobile-app` skill.

## Skills

Load a skill before doing the work it covers, not after.

| Skill                      | Load it when                                                                                                                         |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `converge-dev-env`         | Bringing this repo up to the shared dev-env standards, or editing `AGENTS.md` / `CLAUDE.md`.                                         |
| `db-test-isolation`        | Writing or debugging a test that touches the real database — hooks, cleanup, order-dependent failures.                               |
| `decision-comments`        | Writing or reviewing a comment, a README, a commit message or a PR description — anything whose reason is not visible from the code. |
| `dev-environment`          | Before running any command: what goes through `devcontainer exec`, and what to do when the container or its ports misbehave.         |
| `env-and-secrets`          | Adding an environment variable or a secret, or editing `.env*`, `lib/env/*`, `next.config.ts` or `eslint.config.mjs`.                |
| `expo-mobile-app`          | Running or editing anything under `mobile/` — it runs on the host, and its install must never reach the root workspace.              |
| `list-queries`             | Adding a list, picker, search or filter over a table that can grow past a handful of rows.                                           |
| `next-caching`             | Writing `'use cache'`, `cacheTag`, `updateTag` or a `<Suspense>` boundary — or a page showing stale data.                            |
| `next-data-layout`         | Creating a route or a domain, or deciding where `data.ts`, `service.ts`, `cache.ts` or `validations.ts` belongs.                     |
| `next-server-actions`      | Writing `actions.ts`, `validations.ts` or `api/route.ts`; wiring a form, `useActionState` or `redirect()`.                           |
| `prisma-harness`           | Editing `prisma/schema.prisma`, adding a migration, touching the Vitest/Prisma wiring, or bumping the Prisma/pg stack.               |
| `prisma-rename-migrations` | Renaming anything the database already holds — a table, a column, an enum value, or a string stored in a row.                        |
| `seed-fixtures`            | Writing or running the development seed (`prisma/seed.ts`, `pnpm db:seed`).                                                          |
| `test-mocking`             | Writing a Vitest file that uses `vi.mock`, `vi.fn()` or `vi.hoisted()` — or a mock leaking between tests.                            |
| `toolchain`                | Editing `package.json` or `pnpm-workspace.yaml` — a script, a dependency, a version pin.                                             |
| `transactional-email`      | Adding or changing an email, a template under `emails/`, a `send*Email` function, or the provider wiring.                            |
| `verify-in-browser`        | Before reporting any user-visible change done — `app/**`, `components/**`, styles, copy, `emails/**`.                                |
