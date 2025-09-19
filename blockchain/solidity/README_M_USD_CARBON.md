# mUSD (Carbon) Protocol Contracts

## Overview

The mUSD Carbon protocol integrates Tron into the mUSD Core product, enabling cross-chain functionality with Ethereum using LayerZero. This setup allows for stablecoin operations on the Tron network while maintaining connectivity to Ethereum-based assets.

## Quick Start

1. Install dependencies:

    ```
    yarn install
    ```

2. Navigate to the solidity directory:

    ```
    cd blockchain/solidity
    ```

3. Set up environment file (e.g., .env.test for testnet):

    ```
    cp .env.example .env.test
    # Edit with your keys and RPC URLs
    ```

4. Compile contracts:
    ```
    yarn compile
    ```

## Project Structure (Relevant to Carbon)

- `contracts/solutions/Carbon/`: Carbon-specific contracts for Ethereum and Tron
    - `ethereum/`: Ethereum-side contracts (e.g., AgentLZ)
    - `tron/`: Tron-side contracts (e.g., AccountantLZ, TronOFTVault, TronOracle)
- `configs/mUSD/`: Configuration files
    - `ethereum/`: Sepolia (devnet), mainnetBeta, mainnetProd
    - `tron/`: Shasta (devnet), mainnetBeta, mainnetProd
- `scripts/mUSD/`: Deployment scripts for multichain and Tron-specific deployments
- `tasks/mUSD/multichain/`: Hardhat tasks for multichain setup

## Environment Setup

Create and configure environment files:

- For testnet: `.env.test` (should be shared by git secret)
- For production: `.env.production`

Required variables (example for testnet):

```
# Ethereum
ETHEREUM_SEED_PHRASE=your_seed
JSON_RPC_URL_SEPOLIA=your_rpc

# Tron
TRON_SEED_PHRASE=your_seed
```

Update configuration files in `configs/mUSD/` for addresses like OWNER, GUARDIAN_ADDRESS, POOL_KEEPER, etc. See \"Missing Configurations for Production\" section below for details.

## Testing

Run tests to ensure everything is working:

```
yarn test
yarn test:forge
yarn test:all
```

## Deployment

Deployment is multichain (Ethereum + Tron) for Carbon. Use the following commands after compiling.

### LayerZero Executor Overview

The **LayerZero Executor** is a critical infrastructure component required for Carbon's cross-chain functionality:

- **Purpose**: Handles execution of cross-chain messages between Ethereum and Tron networks
- **Components**: Deploys `ExecutorFeeLib` and `Executor` contracts on both networks
- **Dependencies**: Must be deployed **before** Carbon contracts as they depend on executor addresses
- **Configuration**: Used by AgentLZ and AccountantLZ for cross-chain communication

⚠️ **Critical**: The executor deployment step cannot be skipped - Carbon contracts will not function without it.

### Test Environment (Sepolia + Shasta)

#### Deployment Order

**Step 1: Deploy LayerZero Executor (Required First)**

- **yarn carbon:executor:deploy:test**: Deploys LayerZero Executor contracts on both Ethereum (Sepolia) and Tron (Shasta). This must be done before deploying Carbon contracts as they depend on the executor for cross-chain message handling.

**Step 2: Deploy Carbon Contracts (Includes LayerZero Configuration)**

- **yarn carbon:deploy:test**: Deploys the core Carbon contracts across Ethereum (Sepolia) and Tron (Shasta) testnets, and automatically configures LayerZero DVN settings and gas limits.

**Step 3: Sync Executor Parameters**

- **yarn carbon:sync:executor:test**: Synchronizes executor parameters across networks for automated message execution on testnets.

**Step 4: Transfer Ownership**

- **yarn carbon:set:owner:test**: Transfers ownership of deployed contracts to the specified owner address on testnets. ⚠️ **Important**: Some contracts use 2-step ownership and require the new owner to call `acceptOwnership()` to complete the transfer.

**Step 5: Optional Components**

- **yarn carbon:tron:deploy:wmUSD:test**: Deploys the wrapped mUSD (wmUSD) contract specifically on the Tron testnet (Shasta).

#### Recovery Commands (Use Only If Step 2 Fails)

If the main deployment fails during LayerZero configuration, you can run these individually:

- **yarn carbon:set:lz:dvn:test**: Configures LayerZero DVN (Decentralized Verifier Network) settings.
- **yarn carbon:set:lz:gaslimit:test**: Sets gas limit parameters for LayerZero operations.

---

### Beta Environment (Mainnet Beta)

#### Deployment Order

**Step 1: Deploy LayerZero Executor (Required First)**

- **yarn carbon:executor:deploy:beta**: Deploys LayerZero Executor contracts on both Ethereum and Tron mainnet beta environments.

**Step 2: Deploy Carbon Contracts (Includes LayerZero Configuration)**

- **yarn carbon:deploy:beta**: Deploys the core Carbon contracts on Ethereum and Tron mainnet beta environments, and automatically configures LayerZero DVN settings and gas limits.

**Step 3: Sync Executor Parameters**

- **yarn carbon:sync:executor:beta**: Syncs executor params for beta networks.

**Step 4: Transfer Ownership**

- **yarn carbon:set:owner:beta**: Sets contract owners for beta deployments. ⚠️ **Important**: Some contracts use 2-step ownership and require the new owner to call `acceptOwnership()` to complete the transfer.

**Step 5: Optional Components**

- **yarn carbon:tron:deploy:wmUSD:beta**: Deploys wmUSD on Tron mainnet beta.

#### Recovery Commands (Use Only If Step 2 Fails)

If the main deployment fails during LayerZero configuration, you can run these individually:

- **yarn carbon:set:lz:dvn:beta**: Configures LayerZero DVN settings for beta mainnets.
- **yarn carbon:set:lz:gaslimit:beta**: Sets gas limits for LayerZero in beta environments.

---

### Production Environment (Mainnet Prod)

#### Deployment Order

**Step 1: Deploy LayerZero Executor (Required First)**

- **yarn carbon:executor:deploy:production**: Deploys LayerZero Executor contracts on both Ethereum and Tron production mainnets.

**Step 2: Deploy Carbon Contracts (Includes LayerZero Configuration)**

- **yarn carbon:deploy:production**: Deploys the core Carbon contracts on production Ethereum and Tron mainnets, and automatically configures LayerZero DVN settings and gas limits.

**Step 3: Sync Executor Parameters**

- **yarn carbon:sync:executor:production**: Syncs executor parameters for production.

**Step 4: Transfer Ownership**

- **yarn carbon:set:owner:production**: Sets owners for production contracts. ⚠️ **Important**: Some contracts use 2-step ownership and require the new owner to call `acceptOwnership()` to complete the transfer.

**Step 5: Optional Components**

- **yarn carbon:tron:deploy:wmUSD:production**: Deploys wmUSD on Tron production mainnet.

#### Recovery Commands (Use Only If Step 2 Fails)

If the main deployment fails during LayerZero configuration, you can run these individually:

- **yarn carbon:set:lz:dvn:production**: Configures LayerZero DVN for production.
- **yarn carbon:set:lz:gaslimit:production**: Sets production gas limits for LayerZero.

### ⚠️ Post-Deployment Integration Required

After any Carbon deployment, you **MUST** integrate AgentLZ with the existing SupplyManager:

```typescript
// SupplyManager owner must execute:
await supplyManager.setAgent(agentLZAddress, true);
```

See the **Critical Integration Step** section below for detailed instructions.

## Updating Contracts

Contracts are generally immutable, but ownership can be transferred:

```
yarn carbon:set:owner:[test|beta|production]
```

### 2-Step Ownership Transfer

Some contracts in the Carbon protocol use OpenZeppelin's `Ownable2Step` pattern for enhanced security. This requires a two-step process to transfer ownership:

1. **Current owner calls `transferOwnership(newOwner)`** - This is done automatically by the owner-setting scripts
2. **New owner must call `acceptOwnership()`** - This must be done manually by the new owner

#### Manual Steps Required

After running the owner-setting scripts, the new owner must:

1. Call `acceptOwnership()` on each contract that uses 2-step ownership
2. Verify ownership transfer completed by checking `owner()` returns the new address

⚠️ **Warning**: Until `acceptOwnership()` is called, the previous owner retains control of the contract.

## 🚨 Critical Integration Step: Adding AgentLZ to SupplyManager

**IMPORTANT**: After deploying Carbon contracts, the AgentLZ must be manually added to the existing SupplyManager before the system can function properly.

### Required Action

The SupplyManager owner must call:

```solidity
supplyManager.setAgent(agentLZAddress, true);
```

### Why This Is Required

- AgentLZ is deployed as a separate contract that handles cross-chain operations with Tron
- SupplyManager maintains a whitelist of authorized agents via the `agents` mapping
- Only authorized agents can call critical functions like `deposit()` and `redeem()` on SupplyManager
- Without this integration, AgentLZ cannot interact with the Core protocol

### How to Execute

1. **Identify the SupplyManager address** from your Core deployment
2. **Use the SupplyManager owner account** (check `supplyManager.owner()`)
3. **Call the setAgent function**:
    ```typescript
    // Via Hardhat script
    const supplyManager = await hre.ethers.getContractAt('SupplyManager', SUPPLY_MANAGER_ADDRESS);
    const tx = await supplyManager.setAgent(AGENT_LZ_ADDRESS, true);
    await tx.wait();
    ```

### Verification

Verify the integration was successful:

```typescript
const isAuthorized = await supplyManager.agents(AGENT_LZ_ADDRESS);
console.log('AgentLZ authorized:', isAuthorized); // Should be true
```

⚠️ **Critical**: The Carbon protocol will not function until this integration step is completed.

### Migrating AccountantLZ and AgentLZ

To migrate (re-deploy) AccountantLZ (Tron) and AgentLZ (Ethereum) while preserving configurations:

- Run the multichain migration task: `yarn carbon:migrate:lz:[env]` (replace [env] with test, beta, or production)

**Warnings from Migration Scripts (Manual Steps Required)**:

- **🚨 CRITICAL**: Please setup SupplyManager to work with the deployed AgentLZ separately (Ethereum side) - See "Critical Integration Step" section above.
- Please setup RebaseToken to work with the deployed AccountantLZ separately (Tron side).
- Please setup Oracle to make the deployed AccountantLZ authorized to update it separately (Tron side).

## Verification

Verify deployed contracts on block explorers using the verification scope:

```bash
# Verify Carbon contracts across all environments
yarn carbon:verify:test        # Test environment (Sepolia)
yarn carbon:verify:beta        # Beta environment (Mainnet)
yarn carbon:verify:production  # Production environment (Mainnet)
```
