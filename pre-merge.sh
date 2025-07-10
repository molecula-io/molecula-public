#!/bin/bash

if [ "$(uname | tr '[:upper:]' '[:lower:]' | grep -o 'linux')" ] ; then
  echo "Set shell option 'set -e'"
  # Exit immediately if a command exits with a non-zero status
  set -e
fi

echo "📊 Checking versions..."
yarn run check-versions

# Only merge main branch if we're targeting main in the MR
if [ -n "${CI_MERGE_REQUEST_TARGET_BRANCH_NAME}" ] && [ "${CI_MERGE_REQUEST_TARGET_BRANCH_NAME}" = "main" ]; then
  echo "🔄 MR targeting main branch detected. Merging main branch into current branch..."

  # Set Git identity for CI environment (local to this repository) only if not already configured
  if [ -z "$(git config user.email)" ]; then
    echo "Setting up Git user.email..."
    git config --local user.email "ci@dats.tech"
  fi

  if [ -z "$(git config user.name)" ]; then
    echo "Setting up Git user.name..."
    git config --local user.name "Molecula CI"
  fi

  git fetch origin main
  git merge origin/main --no-edit || { echo "❌ Merge failed. Please resolve conflicts manually."; exit 1; }
  echo "✅ Successfully merged main branch"
fi

NO_GENERATE=false
IS_WEBSITE=false
IS_BLOCKCHAIN=false

POSITIONAL_ARGS=()

while [[ $# -gt 0 ]]; do
  case $1 in
    --no-generate)
      NO_GENERATE=true
      shift # past argument
      ;;
    -*|--*)
      echo "Unknown option $1"
      exit 1
      ;;
    *)
      POSITIONAL_ARGS+=("$1") # save positional arg
      shift # past argument
      ;;
  esac
done

if git diff-tree --no-commit-id --name-only -r HEAD | grep -q '^blockchain/'; then
  IS_BLOCKCHAIN=true
fi

if [[ "${IS_BLOCKCHAIN}" == true ]]; then

  echo "🔍 Running solidity code quality checks..."
  yarn turbo run lintspec:check --filter=@molecula-monorepo/solidity \
    docs:generate --filter=@molecula-monorepo/solidity \
    solhint:check --filter=@molecula-monorepo/solidity || { echo "❌ Code quality checks failed"; exit 1; }
    # Temporary disable the following until the issues with "429 Too Many Requests" is resolved:
    # test --filter=@molecula-monorepo/solidity --filter=@molecula-monorepo/blockchain.ethena

  # Run slither first and do it separately because slither cleans compiled artifacts
  echo "🔍 Running slither check..."
  turbo run slither --affected || { echo "❌ pre-merge slither failed"; exit 1; }
fi

if git diff-tree --no-commit-id --name-only -r HEAD | grep -q '^frontend/website/'; then
  IS_WEBSITE=true
fi

# [Re-]generate all required types in parallel first.
if [[ "${NO_GENERATE}" == false ]]; then
  if [[ "${IS_WEBSITE}" == true ]]; then
    echo "🔍 Running code generation for website..."
    yarn turbo run gql:generate || { echo "❌ Code generation failed"; exit 1; }
  else
    echo "🔍 Running code generation..."
    yarn turbo run compile gql:generate || { echo "❌ Code generation failed"; exit 1; }
  fi
fi

# Then run the required checks in parallel
echo "🔍 Running general code quality checks..."
yarn turbo run tsc \
  eslint:check \
  prettier:check \
  cycles:check \
  unitTests || { echo "❌ Code quality checks failed"; exit 1; }


if [[ "${IS_BLOCKCHAIN}" == true && -n "${CI_MERGE_REQUEST_SOURCE_BRANCH_NAME}" ]]; then
  echo "🔍 Running forge tests..."

  git config --global --add safe.directory /builds/datsteam/molecula/molecula-monorepo
  git config --global --add safe.directory /builds/datsteam/molecula/molecula-monorepo/blockchain/solidity/lib/forge-std

  cd /builds/datsteam/molecula/molecula-monorepo/blockchain/solidity
  forge install
  forge build
  forge test
fi
