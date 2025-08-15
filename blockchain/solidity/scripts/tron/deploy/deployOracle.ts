import { type HardhatRuntimeEnvironment } from 'hardhat/types';
import type { TronWeb } from 'tronweb';

import type { EnvironmentType } from '@molecula-monorepo/blockchain.addresses';

import { getTronEnvironmentConfig } from '../../utils/deployUtils';

import { waitForDeployment } from './waitForDeployment';

/**
 * Deploys the Tron-compatible Oracle contract (`TronOracle`).
 * This function:
 *      1. Loads Tron environment config values.
 *      2. Reads the `TronOracle` artifact.
 *      3. Builds and signs a Tron `createSmartContract` transaction.
 *      4. Sends the transaction to the network.
 *      5. Waits for deployment confirmation and returns the contract's base58 address.
 *
 * @param hre         - Hardhat runtime environment (with TronWeb injected).
 * @param environment - Deployment environment name (e.g., "mainnet", "testnet").
 * @returns             Deployed oracle contract address (base58 format).
 */
export async function deployOracle(
    hre: HardhatRuntimeEnvironment,
    environment: EnvironmentType,
): Promise<string> {
    // --------------------------------------------------------------------------------------------
    // Load Tron-specific environment configuration (initial supply, updater address, etc.).
    // --------------------------------------------------------------------------------------------
    const config = getTronEnvironmentConfig(environment);

    // --------------------------------------------------------------------------------------------
    // Resolve deployer account (base58 format) from the loaded PRIVATE_KEY in TronWeb.
    // --------------------------------------------------------------------------------------------
    const issuerAddress = hre.tronweb.defaultAddress.base58 as string;

    // --------------------------------------------------------------------------------------------
    // Read the compiled `TronOracle` artifact (Tron-compatible ABI + bytecode).
    // --------------------------------------------------------------------------------------------
    const artifact = await hre.artifacts.readArtifact('TronOracle');

    // --------------------------------------------------------------------------------------------
    // Build the deployment transaction:
    // Constructor parameters match `TronOracle`:
    //   1. Initial pool value
    //   2. Initial shares value
    //   3. Owner (initialOwner)
    //   4. Authorized updater address
    //
    // feeLimit is specified in SUN (1 TRX = 1,000,000 SUN).
    // --------------------------------------------------------------------------------------------
    const transaction = await hre.tronweb.transactionBuilder.createSmartContract(
        {
            feeLimit: 1_000_000_000, // 1000 TRX max burn
            // @ts-ignore Tron types
            abi: artifact.abi,
            bytecode: artifact.bytecode,
            // @ts-ignore Tron types
            parameters: [
                config.MUSD_TOKEN_INITIAL_SUPPLY,
                config.MUSD_TOKEN_INITIAL_SUPPLY,
                issuerAddress,
                config.ORACLE_AUTHORIZED_UPDATER,
            ],
        },
        issuerAddress, // Deployer address
    );

    // --------------------------------------------------------------------------------------------
    // Sign and send the transaction to the Tron network.
    // --------------------------------------------------------------------------------------------
    await hre.tronweb.trx.sendRawTransaction(
        await hre.tronweb.trx.sign(transaction, hre.tronweb.defaultPrivateKey as string),
    );

    // --------------------------------------------------------------------------------------------
    // Wait for confirmation and return the deployed oracle address (base58 format).
    // --------------------------------------------------------------------------------------------
    const oracleAddress = await waitForDeployment(hre.tronweb, transaction);
    console.log('Oracle deployed at:', oracleAddress);

    return oracleAddress;
}

/**
 * Sets an authorized updater address for the deployed Oracle contract.
 * Calls the `setAuthorizedUpdater(address)` function on the Oracle contract.
 *
 * @param tronweb           - TronWeb instance (with default signer loaded).
 * @param oracleAddress     - Base58 address of the deployed Oracle contract.
 * @param accountantAddress - Address to grant updater permissions.
 */
export async function setAutorizedUpdater(
    tronweb: TronWeb,
    oracleAddress: string,
    accountantAddress: string,
) {
    // --------------------------------------------------------------------------------------------
    // Get the sender address (must be the Oracle's owner or an already authorized updater).
    // --------------------------------------------------------------------------------------------
    const senderAddress = tronweb.defaultAddress.base58 as string;

    // --------------------------------------------------------------------------------------------
    // Function selector for the target method (Tron expects Solidity-like selectors).
    // --------------------------------------------------------------------------------------------
    const functionSelector = 'setAuthorizedUpdater(address)';

    // --------------------------------------------------------------------------------------------
    // Parameters must match the function signature:
    // Here, a single `address` param representing the updater to be authorized.
    // --------------------------------------------------------------------------------------------
    const parameter = [{ type: 'address', value: accountantAddress }];

    // --------------------------------------------------------------------------------------------
    // Build the smart contract trigger transaction.
    // feeLimit set to 1000 TRX in SUN.
    // --------------------------------------------------------------------------------------------
    const response = await tronweb.transactionBuilder.triggerSmartContract(
        tronweb.address.toHex(oracleAddress), // Convert base58 address to hex
        functionSelector,
        { feeLimit: 1_000_000_000 }, // 1000 TRX
        parameter,
        senderAddress,
    );

    const { transaction } = response;

    // --------------------------------------------------------------------------------------------
    // Sign the transaction with the default private key.
    // --------------------------------------------------------------------------------------------
    const signedTransaction = await tronweb.trx.sign(
        transaction,
        tronweb.defaultPrivateKey as string,
    );

    // --------------------------------------------------------------------------------------------
    // Send the signed transaction to the Tron network.
    // --------------------------------------------------------------------------------------------
    await tronweb.trx.sendRawTransaction(signedTransaction);
}
