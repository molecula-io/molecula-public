# mUSD (Nitrogen) Protocol Contracts

## Overview

The mUSD Nitrogen protocol is the Ethereum-side solution that mints and manages mUSD shares against a basket of ERC20 assets. It handles deposits, redemptions, yield distribution, and optional wrappers (wmUSD, lmUSD). Nitrogen runs fully on Ethereum chain.

Core components:

- Supply layer: `SupplyManager`, `MoleculaPoolTreasuryV2`
- Accounting and control: `AccountantAgent`, `RebaseToken`
- Vaults per asset: `NitrogenTokenVault`
- Extensions: `MUSDLock`, `wmUSD`, `lmUSD`, `RebaseTokenOwner`

## Installation

See [Quick Start](README.md#quick-start) and [Installation](README.md#installation).

## Project Structure (Nitrogen)

- `contracts/solutions/Nitrogen/`: Nitrogen smart contracts (Ethereum)
- `configs/mUSD/ethereum/`: Network configs (Sepolia devnet, mainnetBeta, mainnetProd)
- `scripts/mUSD/ethereum/`: Deployment, setup and verification scripts
- `tasks/mUSD/`: Hardhat tasks for deploying, setup, verification

## Environment Setup

Create and configure environment files:

- For testnet: `.env.test`
- For beta/prod: `.env.production`

Required variables (example for testnet):

```
# Ethereum
ETHEREUM_SEED_PHRASE=your_seed
JSON_RPC_URL=your_rpc_ethereum
JSON_RPC_URL_SEPOLIA=your_rpc_sepolia
```

Update configuration files in `configs/mUSD/ethereum/` for values like `OWNER`, `GUARDIAN_ADDRESS`, `POOL_KEEPER`, `USDT_ADDRESS`, token metadata and min limits.

## Testing

Run tests to ensure everything is working:

```
# hardhat and forge tests
yarn test
yarn test:forge
yarn test:all
```

## Deployment (Nitrogen)

Recommended order:

### 1. Configure Addresses

Set `POOL_KEEPER`, `OWNER` and `GUARDIAN_ADDRESS` in the appropriate config files:

- **Ethereum**:
    - [Sepolia config](configs/mUSD/ethereum/sepolia.ts)
    - [Mainnet Beta config](configs/mUSD/ethereum/mainnetBeta.ts)
    - [Mainnet Production config](configs/mUSD/ethereum/mainnetProd.ts)

- **Tron**:
    - [Shasta config](configs/mUSD/tron/shasta.ts)
    - [Mainnet Beta config](configs/mUSD/tron/mainnetBeta.ts)
    - [Mainnet Production config](configs/mUSD/tron/mainnetProd.ts)

### 2. Deploy Core (pool + supply manager)

```bash
# Test environment
yarn core:deploy:test

# Beta environment
yarn core:deploy:beta

# Production environment
yarn core:deploy:production
```

Use `--nomusde` flag to skip mUSDe contract deployment:

```bash
yarn core:deploy:test --nomusde
```

### 3. Deploy Nitrogen Contracts

```bash
# Test environment
yarn nitrogen:deploy:test

# Beta environment
yarn nitrogen:deploy:beta

# Production environment
yarn nitrogen:deploy:production
```

### 4. Updating Contracts / Ownership

Ownership can be transferred where supported:

```bash
# Set core owner
yarn core:set:owner:[test|beta|production]

# Set nitrogen owner
yarn nitrogen:set:owner:[test|beta|production]
```

For Ownable2Step contracts:

1. `transferOwnership(newOwner)` by current owner (scripted)
2. `acceptOwnership()` by new owner (manual)

### Specialized Deployments

#### Deploy RebaseTokenOwner

1. Deploy RebaseTokenOwner:

    ```bash
    yarn nitrogen:deploy:tokenOwner:test
    ```

2. Set up the system:
    ```typescript
    await rebaseToken.transferOwnership(rebaseTokenOwner);
    ```

#### Deploy NitrogenTokenVault

1. Deploy NitrogenTokenVault with parameters:

    ```bash
    yarn nitrogen:deploy:vault:test \
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
yarn nitrogen:deploy:wmUSD:[test|beta|production] --yield-dist <YIELD_DISTRIBUTOR>
```

Note, that if `--yield-dist` isn't provided, than a contract owner is used by default.

#### Deploy lmUSD Contract

```bash
yarn nitrogen:deploy:lmUSD:test
```

#### Deploy PriceChecker Contract

1. Deploy PriceChecker Contract:

    ```bash
    yarn nitrogen:deploy:priceChecker:test
    ```

2. Set up the system:

    ```typescript
    await moleculaPoolTreasuryV2.setPriceChecker(priceCheckerAddress);
    await nitrogenTokenVault.setPriceChecker(priceCheckerAddress);
    ```

### Verification

After deployment, verify contracts on block explorers using the verification scope:

```bash
# Verify Nitrogen contracts
yarn nitrogen:verify:test        # Test environment (Sepolia)
yarn nitrogen:verify:beta        # Beta environment (Mainnet)
yarn nitrogen:verify:production  # Production environment (Mainnet)
```

## Verification of protocol configuration

- `SupplyManager` has `AccountantAgent` authorized (`agents(agent)=true`)
- `RebaseToken.accountant()` equals `AccountantAgent`
- Each `NitrogenTokenVault` initialized with correct `asset`, `minDepositAssets`, `minRedeemShares`
- `SupplyManager.authorizedYieldDistributor()` equals `POOL_KEEPER`

To verify the protocol configuration, use the following command:

```bash
# Verify Nitrogen protocol configuration across all environments and chains
yarn nitrogen:verify:configuration:test        # Test environment (Sepolia)
yarn nitrogen:verify:configuration:beta        # Beta environment (Mainnet Ethereum)
yarn nitrogen:verify:configuration:production  # Production environment (Mainnet Ethereum)
```
