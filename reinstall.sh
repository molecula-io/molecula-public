#!/bin/bash

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

echo "Removing cache..."
rm_global "cache"

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
