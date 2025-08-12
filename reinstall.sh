#!/bin/bash

NO_CLEAN_CACHE=false

POSITIONAL_ARGS=()

while [[ $# -gt 0 ]]; do
  case $1 in
    --no-clean-cache)
      NO_CLEAN_CACHE=true
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

source ./install_utils.sh

if [ "$(uname | tr '[:upper:]' '[:lower:]' | grep -o 'linux')" ] ; then
  echo "Set shell option 'set -e'"
  set -e
fi

echo "📊 Checking versions..."
yarn run check-versions

# Add the rm_global function
source ./rm_global.sh

echo "Removing node_modules..."
rm_global "node_modules"

echo "Removing previous artifacts..."
rm_global "artifacts"

echo "Removing previous builds..."
rm_global "build"

if [[ "${NO_CLEAN_CACHE}" == false ]]; then
  echo "Removing cache..."
  rm_global "cache"
fi

echo "Removing forge cache..."
rm_global "cache_forge"

echo "Removing typechain files..."
rm_global "typechain"
rm_global "typechain-types"

echo "Cleanup completed!"

echo "Installing dependencies..."
yarn install --frozen-lockfile --network-concurrency 3 --network-timeout 300000


install_or_update_slither

install_lintspec_if_needed

echo "Revealing secrets..."
if [ -x "$(command -v osascript)" ]
then
 osascript -e "display notification \"Waiting for secret files revealing\" with title \"Molecula-monorepo\""
fi
yarn run secret:reveal

echo "Compiling smart contracts..."
yarn turbo run compile

echo "Generating GQL types..."
yarn turbo run gql:generate

echo "Reinstall completed!"
if [ -x "$(command -v osascript)" ]
then
  osascript -e "display notification \"Reinstalled!\" with title \"Molecula-monorepo\""
fi
