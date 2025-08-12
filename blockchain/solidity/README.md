# Solidity Contracts

A comprehensive codebase for Ethereum and Tron networks including smart contracts, deployment scripts and testing infrastructure.

## Table of Contents

-   [Prerequisites](#prerequisites)
-   [Quick Start](#quick-start)
-   [Installation](#installation)
-   [Project Structure](#project-structure)
-   [Development Workflow](#development-workflow)
-   [Environment Setup](#environment-setup)
-   [Testing](#testing)
-   [Code Coverage](#code-coverage)
-   [Fireblocks Integration](#fireblocks-integration)
-   [Contracts Deployment](#contracts-deployment)
-   [Security](#security)
-   [Troubleshooting](#troubleshooting)

## Prerequisites

Before you begin, ensure you have the following installed:

-   **Node.js 20+** - [Download here](https://nodejs.org/)
-   **Yarn** - Package manager (`npm install -g yarn`)
-   **Foundry/Forge** - For testing and development (see installation below)
-   **Git** - Version control

## Quick Start

1. **Clone and install dependencies:**

    ```bash
    cd blockchain/solidity
    yarn install
    ```

2. **Set up environment:**

    ```bash
    cp .env.test.example .env.test
    # Edit .env.test with your configuration
    ```

3. **Compile contracts:**

    ```bash
    yarn compile
    ```

4. **Run tests:**
    ```bash
    yarn test
    ```

## Installation

### Installing Foundry

Foundry is a blazing fast, portable and modular toolkit for Ethereum application development written in Rust. It includes forge, a tool for building, testing and deploying smart contracts.

#### Install Foundryup (the Foundry installer/updater):

Run the following command in your terminal:

```bash
curl -L https://foundry.paradigm.xyz | bash
```

Restart your terminal session or source your profile script (e.g., `source ~/.bashrc`, `source ~/.zshrc`) to update your PATH with the foundry binaries.

Run foundryup to install or update to the latest version of Forge:

```bash
foundryup
```

For more detailed installation and configuration instructions, see [Foundry's official documentation](https://book.getfoundry.sh/getting-started/installation).

## Project Structure

```
blockchain/solidity/
├── contracts/         # Smart contract source files
├── scripts/           # Deployment and utility scripts
├── test/              # Test files
├── configs/           # Network and deployment configurations
├── tasks/             # Hardhat custom tasks
├── docs/              # Documentation
└── audits/            # Security audit reports
```

### Key Directories

-   **`contracts/`** - Contains all Solidity smart contracts organized by solution (core, nitrogen, carbon)
-   **`scripts/`** - Deployment scripts for different networks and environments
-   **`configs/`** - Network-specific configurations for Ethereum and Tron networks
-   **`test/`** - Comprehensive test suite for all contracts

## Development Workflow

### Compilation

To compile contracts:

```bash
yarn compile
```

This will compile all contracts and generate artifacts in the `artifacts/` directory.

### Linting and Code Quality

```bash
# Check code style
yarn eslint:check

# Fix code style issues
yarn eslint:fix

# Check Solidity code style
yarn solhint:check

# Fix Solidity code style
yarn solhint:fix

# Run all code quality checks
yarn fix:code
```

### Security Analysis

```bash
# Run Slither security analysis
yarn slither

# Run Aderyn security analysis
yarn aderyn
```

## Environment Setup

### Required Environment Variables

Create the following environment files based on your deployment target:

#### For Testnet Development (`.env.test`)

```bash
# Ethereum Configuration
ETHEREUM_SEED_PHRASE=your_ethereum_seed_phrase
JSON_RPC_URL_SEPOLIA=your_sepolia_rpc_url
ETHEREUM_API_KEY=your_etherscan_api_key

# Tron Configuration
TRON_SEED_PHRASE=your_tron_seed_phrase

# Optional: Fork configuration
JSON_RPC_URL=your_mainnet_rpc_url
FORK_BLOCK_NUMBER=latest_block_number
```

#### For Production (`.env.production`)

```bash
# Production environment variables
# Copy from .env.test and update with production values
```

### Network Configurations

The project supports multiple networks:

-   **Sepolia** - Ethereum testnet
-   **Holesky** - Ethereum testnet
-   **Ethereum Mainnet** - Production Ethereum
-   **Shasta** - Tron testnet
-   **Tron Mainnet** - Production Tron

## Testing

### Running Tests

```bash
# Run Hardhat tests
yarn test

# Run Forge tests
yarn test:forge

# Run all tests (Hardhat + Forge)
yarn test:all
```

### Running Tests with Forge

After compiling your contracts, you can run the tests with Forge:

```bash
yarn test:forge
```

This command will compile your contracts, run the tests and output the results in your terminal.

## Code Coverage

Generate code coverage reports:

```bash
yarn coverage
```

This creates a coverage folder with detailed reports. You can view the HTML report by opening `./coverage/index.html` in your browser.

## Fireblocks Integration

The project includes Fireblocks integration for secure transaction signing and deployment. This allows you to deploy contracts using Fireblocks' secure infrastructure instead of local private keys.

> **Note**: Currently, only Sepolia testnet is available for Fireblocks integration. Mainnet support will be added in future updates.

### Setup

1. **Install Dependencies**: The Fireblocks packages are already included in the project:

    - `@fireblocks/hardhat-fireblocks`: Hardhat plugin for Fireblocks integration
    - `@fireblocks/fireblocks-web3-provider`: Web3 provider for Fireblocks

2. **Environment Configuration**: Create a `.env.fireblocks.testnet` file with the following variables:

    ```bash
    FIREBLOCKS_API_KEY=your_fireblocks_api_key
    FIREBLOCKS_API_PRIVATE_KEY_PATH=path_to_your_private_key_file
    JSON_RPC_URL_SEPOLIA=your_sepolia_rpc_url
    ```

3. **Fireblocks Configuration**: The hardhat config includes a `sepolia_fireblocks` network that uses Fireblocks for transaction signing:
    ```typescript
    sepolia_fireblocks: {
        url: process.env.JSON_RPC_URL_SEPOLIA,
        fireblocks: {
            privateKey: process.env.FIREBLOCKS_API_PRIVATE_KEY_PATH,
            apiKey: process.env.FIREBLOCKS_API_KEY,
            vaultAccountIds: [1, 2],
            logRequestsAndResponses: true,
            logTransactionStatusChanges: true,
        },
    }
    ```

### Usage

To run scripts using Fireblocks, use the `sepolia_fireblocks` network:

```bash
# Deploy core contracts using Fireblocks
yarn deploy:core:test --network sepolia_fireblocks

# Deploy nitrogen contracts using Fireblocks
yarn deploy:nitrogen:test --network sepolia_fireblocks

# Set owners using Fireblocks
yarn set:core:owner:test --network sepolia_fireblocks
yarn set:nitrogen:owner:test --network sepolia_fireblocks
```

### Security Benefits

-   **Secure Key Management**: Private keys are stored securely in Fireblocks vaults
-   **Multi-signature Support**: Leverage Fireblocks' multi-signature capabilities
-   **Policy Enforcement**: Apply custom policies and approval workflows

### Configuration Options

-   `vaultAccountIds`: Array of vault account IDs to use for signing
-   `logRequestsAndResponses`: Enable detailed logging for debugging
-   `logTransactionStatusChanges`: Track transaction status changes

## Contracts Deployment

### Prerequisites

Before deploying, ensure you have:

1. **Set up environment variables** (see [Environment Setup](#environment-setup))
2. **Generated wallet addresses** using `yarn generate:wallet`
3. **Configured network settings** in the appropriate config files

### Deployment Process

#### 1. Configure Addresses

Set `POOL_KEEPER`, `OWNER` and `GUARDIAN_ADDRESS` in the appropriate config files:

-   **Ethereum**:

    -   [Sepolia config](./configs/ethereum/sepoliaTyped.ts)
    -   [Mainnet Beta config](./configs/ethereum/mainnetBetaTyped.ts)
    -   [Mainnet Production config](./configs/ethereum/mainnetProdTyped.ts)

-   **Tron**:
    -   [Shasta config](./configs/tron/shastaTyped.ts)
    -   [Mainnet Beta config](./configs/tron/mainnetBetaTyped.ts)
    -   [Mainnet Production config](./configs/tron/mainnetProdTyped.ts)

#### 2. Deploy Core Contracts

```bash
# Test environment
yarn deploy:core:test

# Beta environment
yarn deploy:core:beta

# Production environment
yarn deploy:core:production
```

Use `--nomusde` flag to skip mUSDe contract deployment:

```bash
yarn deploy:core:test --nomusde
```

#### 3. Deploy Nitrogen Contracts

```bash
# Test environment
yarn deploy:nitrogen:test

# Beta environment
yarn deploy:nitrogen:beta

# Production environment
yarn deploy:nitrogen:production
```

#### 4. Deploy Carbon Contracts

> **Note**: Carbon deployment needs to be fixed after carbon contracts refactor.

```bash
# Test environment
yarn deploy:carbon:test

# Beta environment
yarn deploy:carbon:beta

# Production environment
yarn deploy:carbon:production
```

#### 5. Set Contract Owners

```bash
# Set core owner
yarn set:core:owner:[test|beta|production]

# Set nitrogen owner
yarn set:nitrogen:owner:[test|beta|production]

# Set carbon owner
yarn set:carbon:owner:[test|beta|production]
```

### Specialized Deployments

#### Deploy RebaseTokenOwner

1. Deploy RebaseTokenOwner:

    ```bash
    yarn deploy:rebaseTokenOwner:test
    ```

2. Set up the system:
    ```typescript
    await rebaseToken.transferOwnership(rebaseTokenOwner);
    ```

#### Deploy NitrogenTokenVault

1. Deploy NitrogenTokenVault with parameters:

    ```bash
    yarn deploy:nitrogenTokenVault:test \
      --token-name <TOKEN_NAME> \
      --token <TOKEN_ADDRESS> \
      --min-deposit <MIN_DEPOSIT> \
      --min-redeem <MIN_REDEEM>
    ```

    Parameters:

    - `--token`: ERC20 token address
    - `--token-name`: Token name
    - `--min-deposit`: Minimal deposit assets
    - `--min-redeem`: Minimal redeem shares

2. Set up the system:

    ```typescript
    // Accept ownership
    await NitrogenTokenVault.acceptOwnership();

    // Set as agent
    await SupplyManager.setAgent(NitrogenTokenVault, true);

    // Add to RebaseTokenOwner
    const codeHash = keccak256((await NitrogenTokenVault.getDeployedCode())!);
    await rebaseTokenOwner.setCodeHash(codeHash, true);
    await rebaseTokenOwner.addTokenVault(NitrogenTokenVault);
    ```

#### Deploy wmUSD Contracts

```bash
yarn deploy:wmUSD:[test|beta|production] --yield-dist <YIELD_DISTRIBUTOR>
```

#### Deploy lmUSD Contract

```bash
yarn deploy:lmUSD:test
```

### Verification

After deployment, verify contracts on Etherscan:

```bash
# Verify Carbon on Sepolia
yarn verify:carbonSepolia

# Verify mrETH on Sepolia
yarn verify:mrEthSepolia

# Verify mrETH on Holesky
yarn verify:mrEthHolesky

# Verify MetaEth on Sepolia
yarn verify:metaEthSepolia

# Verify Nitrogen on Sepolia
yarn verify:nitrogenSepolia
```

## Security

### Best Practices

1. **Always test on testnets first** before deploying to mainnet
2. **Verify all contracts** on block explorers after deployment
3. **Run security analysis** tools before deployment:
    ```bash
    yarn slither
    ```

### Security Tools

-   **Slither**: Static analysis tool for Solidity
-   **Aderyn**: Security analysis tool
-   **Solhint**: Solidity linting tool

### Audit Reports

Security audit reports are stored in the `audits/` directory. Always review these before production deployments.

## Troubleshooting

### Common Issues

#### Compilation Errors

1. **Version conflicts**: Ensure you're using the correct Solidity version
2. **Missing dependencies**: Run `yarn install` to install all dependencies
3. **Import errors**: Check that all import paths are correct

#### Deployment Failures

1. **Insufficient gas**: Increase gas limit in deployment scripts
2. **Network issues**: Verify RPC URL and network connectivity
3. **Environment variables**: Ensure all required environment variables are set

#### Test Failures

1. **Network forking issues**: Check RPC URL and block number
2. **Timeout errors**: Increase timeout in test configuration
3. **Gas estimation failures**: Check contract complexity and gas limits

### Getting Help

1. Check the [Issues](https://github.com/molecula-io/molecula-public/issues) page for known problems
2. Review the test files for examples of proper usage
3. Consult the [Hardhat documentation](https://hardhat.org/docs)
4. Check [Foundry documentation](https://book.getfoundry.sh/)

---

For more information contact the development team.
