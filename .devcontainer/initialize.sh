#!/bin/bash
# Generates docker-compose.worktree.yml for git worktree support

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_DIR="$(dirname "$SCRIPT_DIR")"
GIT_PATH="$WORKSPACE_DIR/.git"
OVERRIDE_FILE="$SCRIPT_DIR/docker-compose.worktree.yml"

if [ -f "$GIT_PATH" ]; then
    echo "Detected git worktree setup"

    # Use git to find the common directory (handles worktrees correctly)
    COMMON_DIR=$(git -C "$WORKSPACE_DIR" rev-parse --git-common-dir 2>/dev/null)

    # Resolve to absolute path if relative
    if [[ "$COMMON_DIR" != /* ]]; then
        COMMON_DIR=$(cd "$WORKSPACE_DIR" && cd "$COMMON_DIR" && pwd)
    fi

    echo "Main .git directory: $COMMON_DIR"

    # Quote paths in YAML to handle spaces in directory names
    cat > "$OVERRIDE_FILE" << EOF
# Auto-generated for git worktree support - DO NOT EDIT
version: '3.8'

services:
  app:
    volumes:
      - "${COMMON_DIR}:${COMMON_DIR}:cached"
EOF

    echo "Generated docker-compose.worktree.yml with git worktree mount"
else
    echo "Standard git repository (not a worktree)"

    cat > "$OVERRIDE_FILE" << EOF
# Auto-generated - no worktree mounts needed
version: '3.8'

services:
  app: {}
EOF
fi
