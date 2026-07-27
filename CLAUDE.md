@AGENTS.md

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Devcontainer Execution

This project runs inside a Docker devcontainer. Conductor (always) and Claude Code (sometimes) run on the host machine.

**Important**: Do not create or start the devcontainer yourself. If the devcontainer is not running, ask the user to start it.

Run commands using the wrapper script:

```bash
.devcontainer/run pnpm install
.devcontainer/run pnpm dev
.devcontainer/run pnpm test:run
```

The script auto-detects context and runs commands inside the container when needed.

### CRITICAL: Command Execution Rules

**NEVER run commands directly on the host.** This includes:

- `pnpm`, `npm`, `npx`, `node`
- Any build, test, lint, or type-check commands

**ALWAYS prefix commands with:** `.devcontainer/run`

If the devcontainer is not running, **STOP** and ask the user to start it. Do not attempt workarounds or run commands on the host.
