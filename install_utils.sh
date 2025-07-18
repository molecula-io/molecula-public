#!/bin/bash

# Exit immediately if any command fails
set -eo pipefail

function install_or_update_slither() {
  # https://github.com/crytic/slither
  echo "Trying to install slither via python3 pip..."
  if ! python3 -m pip install --upgrade slither-analyzer >/dev/null 2>&1; then
    echo "pip install failed, trying pipx..."

    # Ensure pipx is installed.
    if ! command -v pipx >/dev/null 2>&1; then
      echo "pipx not found, installing pipx..."
      python3 -m pip install --user pipx
      export PATH="$HOME/.local/bin:$PATH"
      pipx ensurepath
    fi

    # Now install or upgrade slither with pipx
    if ! command -v slither >/dev/null 2>&1; then
      echo "Installing slither via pipx..."
      pipx install slither-analyzer
    else
      echo "Upgrading slither via pipx..."
      pipx upgrade slither-analyzer
    fi
  fi
}

function install_lintspec_if_needed() {
  # Attempt to source Cargo env if it exists to potentially add ~/.cargo/bin to PATH early.
  if [ -f "$HOME/.cargo/env" ]; then
    source "$HOME/.cargo/env"
  fi

  # Check if lintspec is already available in PATH.
  if command -v lintspec >/dev/null 2>&1; then
    echo "lintspec is already installed and available in PATH."
    lintspec --version  # Verify and print version for confirmation.
    return 0  # Exit successfully without further action.
  fi

  # If not in PATH, check if the binary exists in the default Cargo installation path.
  LINTSPEC_PATH="$HOME/.cargo/bin/lintspec"
  if [ -x "$LINTSPEC_PATH" ]; then
    echo "lintspec binary found but not in PATH. Adding ~/.cargo/bin to PATH."
    export PATH="$HOME/.cargo/bin:$PATH"
    if command -v lintspec >/dev/null 2>&1; then
      lintspec --version  # Verify after adding to PATH.
      return 0
    else
      echo "Error: Failed to add lintspec to PATH."
      exit 1
    fi
  fi

  # If not installed, proceed with installation.
  # First, ensure Cargo is available.
  if ! command -v cargo >/dev/null 2>&1; then
    echo "Cargo not found. Installing Rust and Cargo..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source "$HOME/.cargo/env"  # Make Cargo available immediately.
    if ! command -v cargo >/dev/null 2>&1; then
      echo "Error: Failed to install or source Cargo."
      exit 1
    fi
  fi

  echo "Installing lintspec..."
  # Install specific version for consistency (pinned to 0.6.1 based on your pipeline logs; adjust if needed).
  # Use --force to reinstall if a different version is present, but only if truly not available.
  cargo install lintspec --version 0.6.1 || { echo "Error: cargo install failed."; exit 1; }

  # After installation, verify the binary exists and is executable.
  if [ -x "$LINTSPEC_PATH" ]; then
    lintspec --version  # Final verification.
  else
    echo "Error: lintspec not found after installation."
    exit 1
  fi
}