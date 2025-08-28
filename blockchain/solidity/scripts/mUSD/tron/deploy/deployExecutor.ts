import { type HardhatRuntimeEnvironment } from 'hardhat/types';

import { type EnvironmentType } from '@molecula-monorepo/blockchain.addresses';

import { getTronEnvironmentConfig } from '../../../utils/deployUtils';

import { waitForDeployment } from './waitForDeployment';

/**
 * Deploys ExecutorFeeLib and Executor contracts to the Tron network.
 *
 * @param hre -     Hardhat runtime environment (for artifact reading).
 * @param mnemonic - Mnemonic phrase for Tron account access.
 * @param path -    Derivation path for Tron account.
 * @param environment - Environment identifier (e.g. 'devnet', 'mainnet/beta', etc).
 * @returns        Deployed addresses in a structured object for config.
 */
export async function deployExecutor(hre: HardhatRuntimeEnvironment, environment: EnvironmentType) {
    // Get TronWeb instance, privateKey, and config for this network.
    const config = getTronEnvironmentConfig(environment);

    // Derive issuer (deployer) address from private key.
    const issuerAddress = hre.tronweb.defaultAddress.base58 as string;

    // --- Deploy ExecutorFeeLib contract ---
    // Read compiled artifact for ExecutorFeeLib (ABI + bytecode).
    const executorFeeLibArtifact = await hre.artifacts.readArtifact('ExecutorFeeLib');

    // Build the contract deployment transaction for ExecutorFeeLib.
    const feeLibDeploymentTransaction = await hre.tronweb.transactionBuilder.createSmartContract(
        {
            feeLimit: 1_000_000_000, // Max TRX for deployment (in SUN)
            // @ts-ignore: ABI and bytecode types may mismatch on TronWeb
            abi: executorFeeLibArtifact.abi,
            bytecode: executorFeeLibArtifact.bytecode,
            // Constructor parameters: (endpointEID, nativeDecimalsRate)
            parameters: [config.LAYER_ZERO_TRON_EID, 1_000_000], // Use 1_000_000 for TRX base (1 TRX = 1,000,000 SUN)
        },
        issuerAddress,
    );

    // Sign and broadcast the deployment transaction for ExecutorFeeLib.
    await hre.tronweb.trx.sendRawTransaction(
        await hre.tronweb.trx.sign(
            feeLibDeploymentTransaction,
            hre.tronweb.defaultPrivateKey as string,
        ),
    );

    // Wait until the contract is deployed and retrieve the deployed address.
    const executorFeeLib = await waitForDeployment(hre.tronweb, feeLibDeploymentTransaction);
    console.log(`Executor Fee Lib address is : ${executorFeeLib}`);

    // --- Deploy Executor contract ---
    // Read compiled artifact for Executor (ABI + bytecode).
    const executorArtifact = await hre.artifacts.readArtifact('Executor');

    // Build the contract deployment transaction for Executor.
    const executorDeploymentTransaction = await hre.tronweb.transactionBuilder.createSmartContract(
        {
            feeLimit: 5_000_000_000, // Higher TRX limit, since this contract is larger
            // @ts-ignore: ABI and bytecode types may mismatch on TronWeb
            abi: executorArtifact.abi,
            bytecode: executorArtifact.bytecode,
            // Constructor parameters:
            // - endpoint address
            // - receive ULN lib address
            // - send ULN lib (array)
            // - price feed address
            // - admin address (DEFAULT_ADMIN_ROLE)
            // - admin addresses array (ADMIN_ROLE)
            parameters: [
                config.LAYER_ZERO_TRON_ENDPOINT,
                config.LAYER_ZERO_RECEIVE_ULN_LIB,
                [config.LAYER_ZERO_SEND_ULN_LIB],
                config.LAYER_ZERO_PRICE_FEED,
                issuerAddress,
                [issuerAddress],
            ],
        },
        issuerAddress,
    );

    // Sign and broadcast the deployment transaction for Executor.
    await hre.tronweb.trx.sendRawTransaction(
        await hre.tronweb.trx.sign(
            executorDeploymentTransaction,
            hre.tronweb.defaultPrivateKey as string,
        ),
    );

    // Wait until the contract is deployed and retrieve the deployed address.
    const executor = await waitForDeployment(hre.tronweb, executorDeploymentTransaction);

    // Convert the Tron address to an EVM-compatible hex string (0x-prefixed).
    const executorHexAdderess = hre.tronweb.address
        .toHex(executor)
        .replace(/^(41)/, '0x') as string;
    console.log(`Executor address is : ${executorHexAdderess}`);

    // Return deployed contract addresses in a structured object.
    return {
        tron: {
            executorFeeLib,
            executor: executorHexAdderess,
        },
    };
}
