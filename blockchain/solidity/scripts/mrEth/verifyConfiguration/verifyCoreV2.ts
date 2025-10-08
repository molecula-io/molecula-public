/*
 * MrETH CoreV2 Contract Verification Module
 *
 * This module contains functions for verifying MrETH CoreV2 contract configuration
 * on Ethereum networks. It handles verification of SupplyManagerV2, RewardBearingToken,
 * and various token vaults configuration.
 */
/* eslint-disable no-await-in-loop, no-restricted-syntax */
import { type HardhatRuntimeEnvironment } from 'hardhat/types';

import type { EnvironmentType, ContractsMrEth } from '@molecula-monorepo/blockchain.addresses';

import type { mrEthNetworkConfig } from '../../../configs';
import type {
    VerificationResult,
    ContractVerification,
} from '../../utils/configurationVerificationUtils';
import { checkValue } from '../../utils/configurationVerificationUtils';
import { getMrEthConfig } from '../../utils/deployUtils';
import { verifySupplyManagerV2 } from '../../verify';

import { verifyAssetTokenVault, verifyMrEthNativeTokenVault } from './verifyMrEthTokenVaults';

/**
 * Verifies RewardBearingToken (mrETH) contract configuration
 * Checks name, symbol, owner, supply manager, and token vaults
 * @param hre - Hardhat runtime environment
 * @param contractAddress - Address of the RewardBearingToken contract
 * @param config - Configuration object with expected values
 * @param contracts - Deployed contracts object
 * @returns results - Array to store verification results
 */
async function verifyRewardBearingToken(
    hre: HardhatRuntimeEnvironment,
    contractAddress: string,
    config: mrEthNetworkConfig,
    contracts: ContractsMrEth,
): Promise<VerificationResult[]> {
    console.log(`\n📋 Verifying RewardBearingToken contract: ${contractAddress}`);

    const results: VerificationResult[] = [];

    const rewardBearingToken = await hre.ethers.getContractAt(
        'RewardBearingToken',
        contractAddress,
    );

    // Verify token name
    const actualName = await rewardBearingToken.name();
    results.push({
        variableName: 'name',
        ...checkValue(config.MRETH_TOKEN_NAME, actualName),
    });

    // Verify token symbol
    const actualSymbol = await rewardBearingToken.symbol();
    results.push({
        variableName: 'symbol',
        ...checkValue(config.MRETH_TOKEN_SYMBOL, actualSymbol),
    });

    // Verify owner
    const actualOwner = await rewardBearingToken.owner();
    results.push({
        variableName: 'owner',
        ...checkValue(config.OWNER, actualOwner),
    });

    // Verify oracle
    const actualOracle = await rewardBearingToken.oracle();
    results.push({
        variableName: 'oracle',
        ...checkValue(contracts.eth.supplyManagerV2, actualOracle),
    });

    // Verify supply manager
    const actualSupplyManager = await rewardBearingToken.SUPPLY_MANAGER();
    results.push({
        variableName: 'SUPPLY_MANAGER',
        ...checkValue(contracts.eth.supplyManagerV2, actualSupplyManager),
    });

    // Verify token vaults are registered (using validateTokenVault method)
    for (const { name, addr } of [
        { name: 'wEthVault', addr: contracts.eth.wEthVault },
        { name: 'stEthVault', addr: contracts.eth.stEthVault },
        { name: 'ethVault', addr: contracts.eth.ethVault },
    ]) {
        let isValid;
        try {
            await rewardBearingToken.validateTokenVault(addr);
            isValid = true;
        } catch (error) {
            isValid = false;
        }
        results.push({
            variableName: `validateTokenVault(${name})`,
            ...checkValue(true, isValid),
        });
    }

    return results;
}

/** vault verifiers moved to './verifyMrEthTokenVaults' */

/**
 * Verifies MrETH CoreV2 contract configuration
 * Checks SupplyManagerV2, RewardBearingToken, and all token vaults
 * @param hre - Hardhat runtime environment
 * @param contracts - Deployed contracts object
 * @param environment - Environment type (devnet, mainnet/beta, mainnet/prod)
 * @returns ContractVerification object with verification results
 */
export async function verifyCoreV2(
    hre: HardhatRuntimeEnvironment,
    contracts: ContractsMrEth,
    environment: EnvironmentType,
): Promise<ContractVerification[]> {
    console.log(`\n🔍 Starting MrETH CoreV2 verification for environment: ${environment}`);

    const { config } = await getMrEthConfig(hre, environment, hre.network.name);
    const verifications: ContractVerification[] = [];

    // Verify SupplyManagerV2
    verifications.push(
        await verifySupplyManagerV2(hre, contracts.eth.supplyManagerV2, {
            owner: config.OWNER,
            yieldDistributor: config.YIELD_DISTRIBUTOR,
            moleculaPool: contracts.eth.depositManagerPool,
            apyFormatter: config.APY_FORMATTER,
            moleculaToken: contracts.eth.mrETH,
        }),
    );

    // Verify RewardBearingToken (mrETH)
    verifications.push({
        contractAddress: contracts.eth.mrETH,
        contractName: 'RewardBearingToken',
        results: await verifyRewardBearingToken(hre, contracts.eth.mrETH, config, contracts),
    });

    // Verify WETH Asset Token Vault
    verifications.push({
        contractAddress: contracts.eth.wEthVault,
        contractName: 'WETHVault',
        results: await verifyAssetTokenVault(
            hre,
            contracts.eth.wEthVault,
            'WETHVault',
            config.WETH_ADDRESS,
            config,
            contracts,
        ),
    });

    // Verify stETH Asset Token Vault
    verifications.push({
        contractAddress: contracts.eth.stEthVault,
        contractName: 'stETHVault',
        results: await verifyAssetTokenVault(
            hre,
            contracts.eth.stEthVault,
            'stETHVault',
            config.STETH_ADDRESS,
            config,
            contracts,
        ),
    });

    // Verify Native ETH Token Vault
    verifications.push({
        contractAddress: contracts.eth.ethVault,
        contractName: 'NativeTokenVault',
        results: await verifyMrEthNativeTokenVault(hre, contracts.eth.ethVault, config, contracts),
    });

    return verifications;
}
