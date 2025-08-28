#!/bin/bash

# Enable testing mode: if TEST_MODE is set to "true", the function won't delete directories
TEST_MODE=false

# Remove directories matching a pattern in the current directory and its subdirectories
# Usage: rm_global <pattern>
# Example: rm_global "node_modules"
rm_global() {
  local pattern="$1"

  # Check required argument
  if [[ -z "$pattern" ]]; then
    echo "Error: Missing required argument 'pattern'. Usage: globstar_rm <pattern>" >&2
    return 1
  fi

  # Use find to locate and optionally remove directories
  if [[ "$TEST_MODE" == "true" ]]; then
    echo "Test mode: Found the following directories matching '$pattern' and ignore .turbo directories:"
    find . -type d -name "$pattern" -a  ! -regex '.*\/\.turbo\/.*'
  else
    echo "Removing directories matching '$pattern' and ignore .turbo directories:"
    find . -type d -name "$pattern" -a  ! -regex '.*\/\.turbo\/.*' -exec rm -rf {} +
  fi
}
