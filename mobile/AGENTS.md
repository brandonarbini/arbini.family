# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# This app runs on the host

`mobile/` is not part of the repository's pnpm workspace. It has its own `pnpm-workspace.yaml`
(an empty workspace root, which stops pnpm walking up to the web app's install), its own
`pnpm-lock.yaml`, and its own `node_modules`. Run `pnpm` and `expo` here, on the host — never
`pnpm install` at the repository root, which would replace the devcontainer's Linux binaries with
macOS ones.

The web app, the database and the tests stay in the devcontainer:
`devcontainer exec --workspace-folder . <command>`, from the repository root.
