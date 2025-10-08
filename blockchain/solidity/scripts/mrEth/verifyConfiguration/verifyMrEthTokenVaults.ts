/*
 * MrETH Token Vaults Verification Module
 */
/* eslint-disable no-await-in-loop, no-restricted-syntax */
import { type HardhatRuntimeEnvironment } from 'hardhat/types';

import type { ContractsMrEth } from '@molecula-monorepo/blockchain.addresses';

import { NATIVE_TOKEN } from '../../../configs';
import type { mrEthNetworkConfig } from '../../../configs';
import type { MrEthAssetTokenVault, MrEthNativeTokenVault } from '../../../typechain-types';
import type { VerificationResult } from '../../utils/configurationVerificationUtils';
import { checkValue } from '../../utils/configurationVerificationUtils';
import { verifyTokenVault } from '../../verify';

/**
 * Shared verifier for MrEth token vaults
 */
export async function verifyMrEthTokenVault(
    vault: MrEthAssetTokenVault | MrEthNativeTokenVault,
    vaultName: string,
    expectedAssetAddress: string,
    config: mrEthNetworkConfig,
    contracts: ContractsMrEth,
): Promise<VerificationResult[]> {
    console.log(`\n📋 Verifying ${vaultName} contract: ${await vault.getAddress()}`);

    const results = await verifyTokenVault(vault, {
        owner: config.OWNER,
        supplyManager: contracts.eth.supplyManagerV2,
        guardian: config.GUARDIAN,
        tokenAddress: expectedAssetAddress,
        minDepositAssets: config.MRETH_TOKEN_MIN_DEPOSIT,
        minRedeemShares: config.MRETH_TOKEN_MIN_REDEEM,
        rebaseTokenV2: contracts.eth.mrETH,
    });

    // Verify yield distributor
    const actualYieldDistributor = await vault.yieldDistributor();
    results.push({
        variableName: 'yieldDistributor',
        ...checkValue(config.YIELD_DISTRIBUTOR, actualYieldDistributor),
    });

    return results;
}

/**
 * Verifies MrEthAssetTokenVault contract configuration
 * Uses the common verification logic with asset-specific parameters
 */
export async function verifyAssetTokenVault(
    hre: HardhatRuntimeEnvironment,
    contractAddress: string,
    vaultName: string,
    expectedTokenAddress: string,
    config: mrEthNetworkConfig,
    contracts: ContractsMrEth,
): Promise<VerificationResult[]> {
    const vault = await hre.ethers.getContractAt('MrEthAssetTokenVault', contractAddress);

    return verifyMrEthTokenVault(vault, vaultName, expectedTokenAddress, config, contracts);
}

/**
 * Verifies MrEthNativeTokenVault contract configuration
 * Uses the common verification logic with native token parameters
 */
export async function verifyMrEthNativeTokenVault(
    hre: HardhatRuntimeEnvironment,
    contractAddress: string,
    config: mrEthNetworkConfig,
    contracts: ContractsMrEth,
): Promise<VerificationResult[]> {
    const vault = await hre.ethers.getContractAt('MrEthNativeTokenVault', contractAddress);
    return verifyMrEthTokenVault(vault, 'MrEthNativeTokenVault', NATIVE_TOKEN, config, contracts);
}
