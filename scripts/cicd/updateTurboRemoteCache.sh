#!/usr/bin/env bash
# Exit immediately if a command exits with a non-zero status
set -e

IS_TEST_MODE=false

# Display help information
display_help() {
  echo "Usage: $0 [OPTIONS]

TURBO CACHE TAG UPDATER
Creates a new turbo-cache tag for remote cache invalidation

OPTIONS:
  -t           (Optional) Test mode - no tags will be created or pushed
  -h           Display this help message" 1>&2
  exit 1
}

# Parse command line arguments
while getopts ":th" option; do
    case "${option}" in
        t)
            IS_TEST_MODE=true
            echo "🧪 Running in TEST MODE - no tags will be created or pushed"
            ;;
        h)
            display_help
            ;;
        *)
            display_help
            ;;
    esac
done
shift $((OPTIND-1))

# Create a new turbo-cache git tag with incremented number
create_turbo_cache_tag() {
    echo "🔍 Fetching latest tags from remote repository ..."
    git fetch --tags --force
    echo "✅ Fetched successfully"
    
    # Find the latest turbo-cache tag
    local tag_pattern="^turbo-cache-[0-9]+$"
    local latest_tag
    latest_tag=$(git tag -l --sort=v:refname | grep -E "$tag_pattern" | tail -n 1)
    echo "  - Latest tag: '$latest_tag'"
    
    local new_tag
    if [[ -z "$latest_tag" ]]; then
        # No existing tag found, start with build number 1
        new_tag="turbo-cache-1"
    else
        # Extract the build number from the latest tag and increment it
        local build_number
        # Try both GNU and BSD sed variants
        build_number=$(echo "$latest_tag" | sed -E "s/^turbo-cache-([0-9]+)$/\1/" 2>/dev/null || 
                      echo "$latest_tag" | sed -r "s/^turbo-cache-([0-9]+)$/\1/")
        
        echo "  - Previous build number: $build_number"
        build_number=$((build_number + 1))
        echo "  - New build number: $build_number"
        
        new_tag="turbo-cache-$build_number"
    fi
    
    echo "  - New tag: '$new_tag'"
    
    if [[ "$IS_TEST_MODE" = true ]]; then
        echo "  [TEST MODE] Would create git tag: $new_tag"
    else
        git tag "$new_tag"
    fi
    echo
}

echo "Creating new turbo-cache tag for remote cache invalidation"
create_turbo_cache_tag

echo "Pushing tags to remote repository..."
if [[ "$IS_TEST_MODE" = true ]]; then
    echo "[TEST MODE] Would push tags to remote repository"
else
    git push --tags
    echo "✅ Turbo cache tag pushed successfully"
fi