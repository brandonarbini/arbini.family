#!/bin/zsh
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
WORKTREE_INCLUDE="$PROJECT_DIR/.worktreeinclude"

if [ -z "$CONDUCTOR_ROOT_PATH" ]; then
    echo "Warning: CONDUCTOR_ROOT_PATH not set. Cannot copy files from root worktree."
    exit 0
fi

if [ ! -d "$CONDUCTOR_ROOT_PATH" ]; then
    echo "Error: CONDUCTOR_ROOT_PATH ($CONDUCTOR_ROOT_PATH) is not a valid directory."
    exit 1
fi

if [ ! -f "$WORKTREE_INCLUDE" ]; then
    echo "No .worktreeinclude file found"
    exit 0
fi

cd "$CONDUCTOR_ROOT_PATH"

# Enable globbing for dotfiles and suppress errors on no-match
setopt NULL_GLOB GLOB_DOTS

# Parse .worktreeinclude and copy matching files
while IFS= read -r pattern || [ -n "$pattern" ]; do
    # Skip empty lines and comments
    [[ -z "$pattern" || "$pattern" =~ ^# ]] && continue

    for file in ${~pattern}; do
        [ -f "$file" ] || continue
        file="${file#./}"
        dest="$PROJECT_DIR/$file"

        # Ensure path doesn't escape PROJECT_DIR via traversal (e.g. "../" components)
        if [[ "$file" == /* || "$file" == *..* ]]; then
            echo "Skipped (unsafe path): $file"
            continue
        fi

        mkdir -p "$(dirname "$dest")"
        cp -Pp "$file" "$dest"
        echo "Copied: $file"
    done
done < "$WORKTREE_INCLUDE"
