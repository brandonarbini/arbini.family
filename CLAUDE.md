@AGENTS.md

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Devcontainer Execution

This project runs inside a Docker devcontainer. Conductor (always) and Claude Code (sometimes) run on the host machine.

**Important**: Do not create or start the devcontainer yourself. If the devcontainer is not running, ask the user to start it.

Run commands with the devcontainer CLI, from the repository root:

```bash
devcontainer exec --workspace-folder . pnpm install
devcontainer exec --workspace-folder . pnpm dev
devcontainer exec --workspace-folder . pnpm test:run
```

### CRITICAL: Command Execution Rules

**NEVER run commands directly on the host.** This includes:

- `pnpm`, `npm`, `npx`, `node`
- Any build, test, lint, or type-check commands

**ALWAYS prefix commands with:** `devcontainer exec --workspace-folder .`

If the devcontainer is not running, **STOP** and ask the user to start it. Do not attempt workarounds or run commands on the host.
