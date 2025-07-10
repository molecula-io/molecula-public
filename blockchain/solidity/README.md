# Solidity contracts

## Installing Forge

Foundry is a blazing fast, portable and modular toolkit for Ethereum application development written in Rust. It includes forge, a tool for building, testing, and deploying smart contracts. Follow these steps to install Foundry/Forge:

### Install Foundryup (the Foundry installer/updater):

Run the following command in your terminal:

```
curl -L https://foundry.paradigm.xyz | bash
```

Restart your terminal session or source your profile script (e.g., source ~/.bashrc, source ~/.zshrc) to update your PATH with the foundry binaries.

Run foundryup to install or update to the latest version of Forge:

```
foundryup
```

For more detailed installation and configuration instructions, see Foundry's official documentation.

### Running Tests with Forge

After compiling your contracts, you can run the tests with Forge. To do so, execute the following command in your project’s root directory:

```
yarn test:forge
```

This command will compile your contracts, run the tests, and output the results in your terminal.

## Contracts compilation

To compile contracts run:

```
yarn compile
```

## Get coverage table

Use `yarn coverage` to create folder coverage

In terminal you can see the table and you can run local host for ./coverage/index.html

## Contracts deployment

### How to deploy contracts to ethereum (mainnet/sepolia) and tron (mainnet/shasta) networks.

1.  Set `POOL_KEEPER`, `OWNER` and `GUARDIAN_ADDRESS` in [eth sepolia config](./configs/ethereum/sepoliaTyped.ts),
    [eth mainnet prod config](./configs/ethereum/mainnetProdTyped.ts) or
    [eth mainnet beta config](./configs/ethereum/mainnetBetaTyped.ts) configs.

    Set `OWNER` in [tron shasta config](./configs/tron/shastaTyped.ts),
    [tron mainnet prod config](./configs/tron/mainnetProdTyped.ts) or
    [tron mainnet beta config](./configs/tron/mainnetBetaTyped.ts)configs.

    To generate ethereum and tron wallet with the same mnemonic you can use [yarn generate:wallet](./package.json).

2.  Deploy core.

    ```
    yarn deploy:core:[test|beta|production] [--nomusde]
    ```

    Use `--nomusde` flag not to deploy mUSDe contract.

    > Note: set a production environment in [.env.production](./.env.production) if needed.

3.  Deploy nitrogen:

    ```
    yarn deploy:nitrogen:[test|beta|production]
    ```

    > Note: set a production environment in [.env.production](./.env.production) if needed.

4.  Deploy carbon: needs to be fixed after carbon contracts refactor

    ```
    yarn deploy:carbon:[test|beta|production]
    ```

    > Note: set a production environment in [.env.production](./.env.production) if needed.

5.  Set correct `owner`, that was set on the first step, in core, nitrogen and carbon solutions:

    ```
    yarn set:core:owner:[test|beta|production]
    yarn set:nitrogen:owner:[test|beta|production]
    yarn set:carbon:owner:[test|beta|production]
    ```

    > Note: set a production environment in [.env.production](./.env.production) if needed.

### How to deploy RebaseTokenOwner

1. Deploy RebaseTokenOwner:

    ```
    yarn deploy:rebaseTokenOwner:test
    ```

2. Set up the system:
   Set RebaseTokenOwner as an owner of RebaseToken

    ```
    await rebaseToken.transferOwnership(rebaseTokenOwner);
    ```

### How to deploy NitrogenTokenVault

1. Deploy NitrogenTokenVault and set ERC20 token address:

    ```
    yarn deploy:nitrogenTokenVault:test --token-name <TOKEN_NAME> --token <TOKEN_ADDRESS> --min-deposit <>
    ```

    `--token` - ERC20 token address.  
    `--token-name` - Token name.  
    `--min-deposit` - Minimal deposit assets.  
    `--min-redeem` - Minimal redeem shares.

2. Set up the system:

    Call `NitrogenTokenVault.acceptOwnership()` function via the actual owner to accept the ownership transfer.

    Call `SupplyManager.setAgent(NitrogenTokenVault, true)`.

    Add NitrogenTokenVault to RebaseTokenOwner:

    ```
    // Add code hash if it's needed
    const codeHash = keccak256((await NitrogenTokenVault.getDeployedCode())!);
    await rebaseTokenOwner.setCodeHash(codeHash, true);

    await rebaseTokenOwner.addTokenVault(NitrogenTokenVault);
    ```

### How to deploy wmUSD and lmUSD contracts.

```
yarn deploy:wmUSD:lmUSD:test
```
