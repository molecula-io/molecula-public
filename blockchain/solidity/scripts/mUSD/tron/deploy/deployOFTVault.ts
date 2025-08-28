import { type HardhatRuntimeEnvironment } from 'hardhat/types';

import {
    type ContractsCarbon,
    type EnvironmentType,
} from '@molecula-monorepo/blockchain.addresses';

import { getTronEnvironmentConfig } from '../../../utils/deployUtils';

import { waitForDeployment } from './waitForDeployment';

/**
 * Deploys an OFTVault contract on the Tron network.
 * This function:
 *   - Uses TronWeb from Hardhat's runtime environment for deployment.
 *   - Reads the TRON-compiled `TronOFTVault` artifact (must match actual build name).
 *   - Constructor parameters must exactly match the order defined in the contract's ABI.
 *   - Returns the deployed contract's address in base58 format.
 *
 * @param hre             - Hardhat runtime with TronWeb injected.
 * @param contractsCarbon - Existing config for Carbon environment.
 * @param environment     - Deployment environment (e.g., "devnet", "mainnet/beta or mainnet/prod").
 * @returns                 The deployed OFTVault address (base58 string).
 */
export async function deployOFTVault(
    hre: HardhatRuntimeEnvironment,
    contractsCarbon: ContractsCarbon,
    environment: EnvironmentType,
): Promise<string> {
    // Deployer (issuer) address in base58 format from TronWeb
    const issuerAddress = hre.tronweb.defaultAddress.base58 as string;

    // Load Tron-specific environment configuration (LayerZero endpoint, EIDs, owner, etc.)
    const config = getTronEnvironmentConfig(environment);

    // Load the TRON-targeted OFTVault artifact (compiled separately for Tron)
    const artifact = await hre.artifacts.readArtifact('TronOFTVault');

    // Build the smart contract deployment transaction
    const transaction = await hre.tronweb.transactionBuilder.createSmartContract(
        {
            feeLimit: 2_000_000_000, // Max TRX to burn for deployment (in SUN; 1 TRX = 1,000,000 SUN)
            // @ts-ignore TronWeb type mismatch
            abi: artifact.abi, // Contract ABI from artifact
            bytecode: artifact.bytecode, // Compiled bytecode
            // Constructor parameters — must exactly match contract ABI order
            // @ts-ignore TronWeb type mismatch
            parameters: [
                config.LAYER_ZERO_TRON_ENDPOINT, // LayerZero Endpoint address on Tron
                config.LAYER_ZERO_ETHEREUM_EID, // Ethereum EID in LayerZero network
                config.OWNER, // Owner of the vault contract
                contractsCarbon.tron.rebaseTokenOwner, // Address allowed to mint/burn rebase token
                contractsCarbon.tron.oracle, // Oracle contract address
                contractsCarbon.tron.rebaseToken, // Underlying token address (mUSD)
            ],
        },
        issuerAddress, // The deployer's base58 address
    );

    // Sign the transaction with the deployer's private key
    const signedTx = await hre.tronweb.trx.sign(
        transaction,
        hre.tronweb.defaultPrivateKey as string,
    );

    // Broadcast the signed transaction to the Tron network
    await hre.tronweb.trx.sendRawTransaction(signedTx);

    const oftVaultAddress = waitForDeployment(hre.tronweb, transaction);
    console.log(`OFTVault deployed at address: ${oftVaultAddress}`);

    // Wait for the contract to be mined and return its deployed base58 address
    return oftVaultAddress;
}
