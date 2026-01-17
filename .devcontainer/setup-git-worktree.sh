#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
WORKTREE_FILE="$SCRIPT_DIR/docker-compose.worktree.yml"

if [ -f "$PROJECT_DIR/.git" ]; then
    GIT_COMMON_DIR=$(cd "$PROJECT_DIR" && git rev-parse --git-common-dir 2>/dev/null)
    if [ -n "$GIT_COMMON_DIR" ] && [ "$GIT_COMMON_DIR" != ".git" ]; then
        GIT_COMMON_DIR_ABSOLUTE=$(cd "$PROJECT_DIR" && cd "$GIT_COMMON_DIR" && pwd)
        cat > "$WORKTREE_FILE" << EOF
services:
  app:
    volumes:
      - ${GIT_COMMON_DIR_ABSOLUTE}:${GIT_COMMON_DIR_ABSOLUTE}:cached
EOF
        exit 0
    fi
fi

# Not a worktree - create empty file so docker-compose doesn't fail
echo "services: {}" > "$WORKTREE_FILE"
