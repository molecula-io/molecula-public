#!/bin/bash

# Exit immediately if any command fails
set -eo pipefail

echo "📊 Checking versions..."
yarn run check-versions

FULL_CHECK=false

IS_BLOCKCHAIN=false

if git diff-tree --no-commit-id --name-only -r HEAD | grep -q '^blockchain/'; then
  IS_BLOCKCHAIN=true
fi

# Check if --full is passed as an argument
for arg in "$@"; do
	if [ "$arg" == "--full" ]; then
		FULL_CHECK=true
		break
	fi
done

# [Re-]generate all required types in parallel first.
echo "🔍 Running pre-commit code generation..."
yarn turbo run compile gql:generate --affected || { echo "❌ pre-commit code generation failed"; exit 1; }

# Run slither first and do it separately because slither cleans compiled artifacts
if [[ "${IS_BLOCKCHAIN}" == true ]]; then
  echo "🔍 Running pre-commit slither check..."
  if command -v slither >/dev/null 2>&1; then
    yarn turbo run slither --affected || { echo "❌ pre-commit slither failed"; exit 1; }
else
    echo "ℹ️ Slither not found, skipping Solidity static analysis"
  fi
fi

# Build the turbo run command dynamically
TURBO_ARGS=(tsc eslint:check prettier:check cycles:check)

if [ "$FULL_CHECK" == true ]; then
  TURBO_ARGS+=(lintspec:check --filter=@molecula-monorepo/solidity)
  TURBO_ARGS+=(solhint:check --filter=@molecula-monorepo/solidity)
  TURBO_ARGS+=(test --filter=@molecula-monorepo/solidity --filter=@molecula-monorepo/blockchain.ethena)
  TURBO_ARGS+=(unitTests)
else
  if [[ "${IS_BLOCKCHAIN}" == true ]]; then
    TURBO_ARGS+=(lintspec:check)
  fi

  TURBO_ARGS+=(--affected)
fi

echo "🔍 Running code quality checks..."
yarn turbo run "${TURBO_ARGS[@]}" || { echo "❌ pre-commit code quality checks failed"; exit 1; }
