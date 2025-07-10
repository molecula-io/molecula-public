#!/bin/bash

# Exit immediately if any command fails
set -eo pipefail

function install_or_update_slither() {
  # https://github.com/crytic/slither
  echo "Trying to install slither via python3 pip..."
  if ! python3 -m pip install --upgrade slither-analyzer >/dev/null 2>&1; then
    echo "pip install failed, trying pipx..."

    # Ensure pipx is installed
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

function install_lintspec() {
  # install cargo if it's not installed
  if ! command -v cargo >/dev/null 2>&1; then
    echo "Installing cargo..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source "$HOME/.cargo/env"  # Make `cargo` available
  fi

  echo "Installing lintspec..."
  # https://github.com/beeb/lintspec
  cargo install lintspec
}