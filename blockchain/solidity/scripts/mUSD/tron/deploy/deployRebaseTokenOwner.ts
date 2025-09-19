import { type HardhatRuntimeEnvironment } from 'hardhat/types';

import {
    type ContractsCarbon,
    type EnvironmentType,
} from '@molecula-monorepo/blockchain.addresses';

import { getTronEnvironmentConfig } from '../../../utils/deployUtils';

import { waitForDeployment } from './waitForDeployment';

/**
 * Deploys the Tron-specific RebaseTokenOwner wrapper contract (`TronRebaseTokenOwner`).
 * This function:
 *       1. Loads the Tron environment configuration.
 *       2. Reads the compiled contract artifact for `TronRebaseTokenOwner`.
 *       3. Builds a TronWeb `createSmartContract` transaction.
 *       4. Signs and broadcasts the transaction.
 *       5. Waits for the deployed contract to be confirmed and returns its base58 address.
 *
 * @param hre              - Hardhat runtime environment (with TronWeb instance injected).
 * @param contractsCarbon  - Contracts registry for the Carbon (Tron) deployment.
 * @param environment      - Deployment environment name (e.g., `mainnet`, `testnet`).
 * @returns                  Deployed contract address in base58 format.
 */
export async function deployRebaseTokenOwner(
    hre: HardhatRuntimeEnvironment,
    contractsCarbon: ContractsCarbon,
    environment: EnvironmentType,
): Promise<string> {
    // --------------------------------------------------------------------------------------------
    // Resolve deployer address from the loaded PRIVATE_KEY in TronWeb.
    // TronWeb stores the default address in base58 format.
    // --------------------------------------------------------------------------------------------
    const issuerAddress = hre.tronweb.defaultAddress.base58 as string;

    // --------------------------------------------------------------------------------------------
    // Load environment-specific constants such as OWNER address.
    // This will provide the guardian (owner) role for the deployed contract.
    // --------------------------------------------------------------------------------------------
    const config = getTronEnvironmentConfig(environment);

    // --------------------------------------------------------------------------------------------
    // Read the compiled artifact for TronRebaseTokenOwner.
    // Ensure that the build includes Tron-compatible bytecode.
    // --------------------------------------------------------------------------------------------
    const artifact = await hre.artifacts.readArtifact('TronRebaseTokenOwner');

    // --------------------------------------------------------------------------------------------
    // Build the transaction to deploy the contract on Tron.
    // feeLimit is set in SUN (1 TRX = 1,000,000 SUN). 2,000,000,000 = 2000 TRX max.
    // Parameter order must exactly match the constructor signature of TronRebaseTokenOwner:
    //   constructor(address initialOwner, address rebaseTokenAddress, address guardianAddress)
    // --------------------------------------------------------------------------------------------
    const transaction = await hre.tronweb.transactionBuilder.createSmartContract(
        {
            feeLimit: 2_000_000_000, // 2000 TRX max burn for resources
            abi: artifact.abi,
            bytecode: artifact.bytecode,
            // Parameters:
            //  1. initialOwner       -> issuerAddress (the deployer's address, may differ if needed)
            //  2. rebaseTokenAddress -> from contractsCarbon.tron registry
            //  3. guardianAddress    -> from config.OWNER (replace if different guardian is required)
            parameters: [issuerAddress, contractsCarbon.tron.rebaseToken, config.OWNER],
        },
        issuerAddress, // Deployer's base58 address
    );

    // --------------------------------------------------------------------------------------------
    // Sign the transaction with the default private key and send it to the network.
    // --------------------------------------------------------------------------------------------
    await hre.tronweb.trx.sendRawTransaction(
        await hre.tronweb.trx.sign(transaction, hre.tronweb.defaultPrivateKey as string),
    );

    // --------------------------------------------------------------------------------------------
    // Wait for the deployment to be confirmed and return the deployed contract's base58 address.
    // --------------------------------------------------------------------------------------------
    const rebaseTokenOwnerAddress = await waitForDeployment(hre.tronweb, transaction);
    console.log(`RebaseTokenOwner deployed at: ${rebaseTokenOwnerAddress}`);
    return rebaseTokenOwnerAddress;
}
