#!/usr/bin/env bash
# Exit immediately if a command exits with a non-zero status
set -e

IS_TEST_MODE=false

# Display usage information and exit
# Arguments:
#   None
# Outputs:
#   Writes usage message to stderr
display_usage() { 
    echo "Usage: $0 [OPTIONS]

OPTIONS:
    -p PACKAGE   (Optional) Specify package to deploy:
                 ┌─────────────────────────────┬─────────────────────────┐
                 │ Package                     │ Environments            │
                 ├─────────────────────────────┼─────────────────────────┤
                 │ back-events-service         │ dev, alpha, beta, prod  │
                 │ back-account-service        │ dev, alpha, beta, prod  │
                 │ back-atoms-service          │ dev, alpha, beta, prod  │
                 │ back-atoms-service-nest     │ dev, alpha, beta, prod  │
                 │ back-carbon                 │ dev, alpha, beta, prod  │
                 │ back-dex-service            │ dev, alpha, beta, prod  │
                 │ back-events-service         │ dev, alpha, beta, prod  │
                 │ back-events-service-metaeth │ dev, alpha, beta, prod  │
                 │ back-info-service           │ dev, alpha, beta, prod  │
                 │ back-info-service-nest      │ dev, alpha, beta, prod  │
                 │ back-monitoring-service     │ dev, alpha, beta, prod  │
                 │ back-nitrogen               │ dev, alpha, beta, prod  │
                 │ back-pool-service           │ dev, alpha, beta, prod  │
                 │ back-pool-service-nest      │ dev, alpha, beta, prod  │
                 │ back-tracker-service-metaeth│ dev, alpha, beta, prod  │
                 │ front                       │ dev, alpha, beta, prod  │
                 │ pool-admin                  │ dev, alpha, beta, prod  │
                 │ retail                      │ dev,        beta, prod  │
                 │ website                     │ dev,        beta, prod  │
                 │ ui-test-image               │ (No environment needed) │
                 └─────────────────────────────┴─────────────────────────┘
                 
    -s STAND     Specify environment: dev, alpha, beta, or prod
                 (Required except for packages without environment in the PACKAGE table)
                 
    -t TEST_MODE  (Optional) Test mode - no actual tags will be created or pushed
" 1>&2
    exit 1 
}

# Get the version from package.json in the root directory
# Arguments:
#   None
# Outputs:
#   Writes version string to stdout
get_package_version() {
    # Try first with grep and awk to avoid Node dependency
    local version
    version=$(grep '"version":' "$(dirname "$0")/../../package.json" | head -1 | awk -F: '{ print $2 }' | sed 's/[",]//g' | tr -d ' \t\n\r')
    
    if [[ -n "$version" ]]; then
        echo "$version"
    else
        # Fallback to Node.js if grep method fails
        echo "$(node -e "console.log(require('$(dirname "$0")/../../package.json').version)")"
    fi
}

# Git tag format explanation:
# Format: <version>-<increment>-<package>-<environment> or <version>-<increment>-<environment> if package is not specified
# Example: 1.2.3-42-front-dev or 1.2.3-42-dev

# Get environments for a package
# Arguments:
#   $1 - package_name: The package to get environments for
# Outputs:
#   Writes space-separated list of environments to stdout
_get_envs_for_package() {
    local pkg_name="$1"
    if [[ -z "$pkg_name" ]]; then
        pkg_name="_global"
    fi

    case "$pkg_name" in
        "front")
            echo "dev alpha beta prod"
            ;;
        "back")
            echo "dev alpha beta prod"
            ;;
        "rpc-proxy")
            echo "dev alpha beta prod"
            ;;
        "back-account-service")
            echo "dev alpha beta prod"
            ;;
        "back-atoms-service")
            echo "dev alpha beta prod"
            ;;
        "back-atoms-service-nest")
            echo "dev alpha beta prod"
            ;;
        "back-carbon")
            echo "dev alpha beta prod"
            ;;
        "back-dex-service")
            echo "dev alpha beta prod"
            ;;
        "back-events-service")
            echo "dev alpha beta prod"
            ;;
        "back-events-service-metaeth")
            echo "dev alpha beta prod"
            ;;
        "back-info-service")
            echo "dev alpha beta prod"
            ;;
        "back-info-service-nest")
            echo "dev alpha beta prod"
            ;;
        "back-monitoring-service")
            echo "dev alpha beta prod"
            ;;
        "back-nitrogen")
            echo "dev alpha beta prod"
            ;;
        "back-pool-service")
            echo "dev alpha beta prod"
            ;;
        "back-pool-service-nest")
            echo "dev alpha beta prod"
            ;;
        "back-tracker-service-metaeth")
            echo "dev alpha beta prod"
            ;;
        "website")
            echo "dev beta prod"
            ;;
        "retail")
            echo "dev beta prod"
            ;;
        "_global")
            echo "dev alpha beta prod"
            ;;
        "pool-admin")
            echo "dev alpha beta prod"
            ;;
        "ui-test-image")
            echo "none"  # Special case - no environment needed
            ;;
        *)
            echo "" # unknown package
            ;;
    esac
}

# Create a new git tag for deployment
# Arguments:
#   $1 - package_name: The package to tag (front, back, website, retail, etc.) or empty string
#   $2 - environment_name: The environment to tag for (dev, alpha, beta, prod) or "none" for packages without environment
# Outputs:
#   Writes tag information to stdout
create_deployment_tag() {
    local package_name="$1"
    local environment_name="$2"
    local version
    version=$(get_package_version)
    
    local tag_pattern
    local tag_suffix

    echo "🔍 Fetching latest tags from remote repository ..." 1>&2
    # Before creating a new deployment tag, fetch the latest tags from the remote repository
    git fetch --tags --force
    echo "✅ Fetched successfully" 1>&2
    
    if [[ -z "$package_name" ]]; then
        # No package specified, use format: <version>-<increment>-<environment>
        tag_pattern="^$version-[0-9]+-$environment_name$"
        tag_suffix="-$environment_name"
    elif [[ "$package_name" == "ui-test-image" ]]; then
        # Packages without environment, use format: <version>-<increment>-<package>
        tag_pattern="^$version-[0-9]+-$package_name$"
        tag_suffix="-$package_name"
    else
        # Package specified, use format: <version>-<increment>-<package>-<environment>
        tag_pattern="^$version-[0-9]+-$package_name-$environment_name$"
        tag_suffix="-$package_name-$environment_name"
    fi
    
    # Find the latest tag matching our pattern
    local latest_tag
    latest_tag=$(git tag -l --sort=v:refname | grep -E "$tag_pattern" | tail -n 1)
    echo "  - Latest tag: '$latest_tag'"
    
    local new_tag
    if [[ -z "$latest_tag" ]]; then
        # No existing tag found, start with build number 1
        new_tag="$version-1$tag_suffix"
    else
        # Extract the build number from the latest tag and increment it
        local build_number
        # Try both GNU and BSD sed variants
        build_number=$(echo "$latest_tag" | sed -E "s/^$version-([0-9]+)-.*/\1/" 2>/dev/null || 
                      echo "$latest_tag" | sed -r "s/^$version-([0-9]+)-.*/\1/")
        
        echo "  - Previous build number: $build_number"
        build_number=$((build_number + 1))
        echo "  - New build number: $build_number"
        
        new_tag="$version-$build_number$tag_suffix"
    fi
    
    echo "  - New tag: '$new_tag'"
    
    if [[ "$IS_TEST_MODE" = true ]]; then
        echo "  [TEST MODE] Would create git tag: $new_tag"
    else
        git tag "$new_tag"
    fi
    
    echo
}

# List available environments for a package
# Arguments:
#   $1 - package_name: The package to get environments for
# Outputs:
#   Writes comma-separated list of environments to stdout
get_available_environments() {
    local package_name="$1"
    local envs
    envs=$(_get_envs_for_package "$package_name")

    if [[ -n "$envs" ]]; then
        echo "$envs" | tr ' ' ', '
    else
        echo "unknown"
    fi
}

# Validate if environment is available for the package
# Arguments:
#   $1 - package_name: The package to check
#   $2 - environment_name: The environment to validate
# Returns:
#   0 if environment is valid for package, 1 otherwise
is_valid_environment_for_package() {
    local package_name="$1"
    local environment_name="$2"
    local envs
    envs=$(_get_envs_for_package "$package_name")

    if [[ -n "$envs" ]]; then
        for env in $envs; do
            if [[ "$env" == "$environment_name" ]]; then
                return 0
            fi
        done
    fi
    return 1
}

# Initialize variables
package_name=""
environment_name=""

# Parse command line arguments
while getopts ":p:s:t" option; do
    case "${option}" in
        p)
            package_name="${OPTARG}"
            # Validate package name by checking if environments exist for it
            if [[ -z "$(_get_envs_for_package "$package_name")" ]]; then
                display_usage
            fi
            ;;
        s)
            environment_name="${OPTARG}"
            # Basic environment name validation
            if [[ "$environment_name" != "dev" ]] && [[ "$environment_name" != "alpha" ]] && 
               [[ "$environment_name" != "beta" ]] && [[ "$environment_name" != "prod" ]]; then
                display_usage
            fi
            ;;
        t)
            IS_TEST_MODE=true
            echo "⚠️ Running in TEST MODE - no tags will be created or pushed"
            ;;
        *)
            display_usage
            ;;
    esac
done
shift $((OPTIND-1))

# Ensure environment is provided for packages with environment
if [[ -z "$environment_name" ]]; then
    if [[ "$package_name" != "ui-test-image" ]]; then
        display_usage
    else
        environment_name="none"  # Use "none" as placeholder for packages without environment
    fi
fi

# Validate if the selected environment is available for the package
if ! is_valid_environment_for_package "$package_name" "$environment_name"; then
    echo "Error: Environment '$environment_name' is not available for package '$package_name'" 1>&2
    echo "Available environments for '$package_name': $(get_available_environments "$package_name")" 1>&2
    exit 1
fi

# Get the version from package.json
version=$(get_package_version)
echo "Using version $version from package.json"

if [[ -z "$package_name" ]]; then
    echo "Creating new deployment tag for all packages in $environment_name environment"
elif [[ "$package_name" == "ui-test-image" ]]; then
    echo "Creating new deployment tag for $package_name"
else
    echo "Creating new deployment tag for $package_name in $environment_name environment"
fi

create_deployment_tag "$package_name" "$environment_name"

echo "Push changes to gitlab ..."
if [[ "$IS_TEST_MODE" = true ]]; then
    echo "[TEST MODE] Would push tags to remote repository"
else
    git push --tags
fi