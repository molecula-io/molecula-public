import { type HardhatRuntimeEnvironment } from 'hardhat/types';

import {
    type ContractsNitrogen,
    type EnvironmentType,
} from '@molecula-monorepo/blockchain.addresses';

import { DEPLOY_GAS_LIMIT } from '../../../configs/ethereum';
import { getEnvironmentConfig } from '../../utils/deployUtils';

/**
 * Deploys the OFTVault contract for a given environment and returns its deployed address.
 * This function:
 *   - Reads network-specific configuration from deploy configs.
 *   - Reads existing deployment addresses from `contracts_nitrogen.json` (to inject dependencies).
 *   - Deploys OFTVault using Hardhat's ethers.js integration.
 *   - Waits for deployment to be mined before returning the deployed address.
 *
 * @param hre             - Hardhat runtime environment (injected by Hardhat task runner).
 * @param contractsCarbon - Existing config for Carbon environment.
 * @param environment     - Deployment environment string (e.g., "staging", "production").
 * @returns                 The deployed OFTVault contract address as a string.
 */
export async function deployOFTVault(
    hre: HardhatRuntimeEnvironment,
    contractsNitrogen: ContractsNitrogen,
    environment: EnvironmentType,
) {
    // ---------------------------------------------------------------------
    // Load configuration values for the specified environment.
    // This typically includes constants like LayerZero endpoint, owner address, etc.
    // ---------------------------------------------------------------------
    const config = getEnvironmentConfig(environment);

    // ---------------------------------------------------------------------
    // Get the contract factory for OFTVault.
    // This allows us to deploy a new instance with the provided constructor args.
    // ---------------------------------------------------------------------
    const OFTVault = await hre.ethers.getContractFactory('OFTVault');

    // ---------------------------------------------------------------------
    // Deploy OFTVault.
    // Constructor args:
    //   1) LayerZero endpoint address (cross-chain messaging entry point)
    //   2) LayerZero Ethereum EID (chain ID in LZ's system)
    //   3) Contract owner address (can differ from deployer wallet)
    //   4) rebaseTokenOwner - address authorized to mint/burn the rebase token
    //   5) supplyManager - address of the Oracle/Supply Manager contract
    // Deployment uses a fixed gas limit from DEPLOY_GAS_LIMIT config.
    // ---------------------------------------------------------------------
    const oftVault = await OFTVault.deploy(
        config.LAYER_ZERO_ENDPOINT,
        config.LAYER_ZERO_ETHEREUM_EID,
        config.OWNER, // NOTE: This is not necessarily the deployer wallet
        contractsNitrogen.eth.rebaseTokenOwner,
        contractsNitrogen.eth.supplyManager,
        { gasLimit: DEPLOY_GAS_LIMIT },
    );

    // ---------------------------------------------------------------------
    // Wait for the deployment transaction to be mined and the contract
    // to be fully deployed before proceeding.
    // ---------------------------------------------------------------------
    await oftVault.waitForDeployment();

    // ---------------------------------------------------------------------
    // Retrieve the deployed contract address.
    // ---------------------------------------------------------------------
    const oftVaultAddress = await oftVault.getAddress();
    console.log('OFTVault address: ', oftVaultAddress);

    // ---------------------------------------------------------------------
    // Return the new address so the caller can store it in the deployment JSON.
    // ---------------------------------------------------------------------
    return oftVaultAddress;
}
