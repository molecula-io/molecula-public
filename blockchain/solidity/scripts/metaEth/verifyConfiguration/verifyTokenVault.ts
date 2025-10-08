/*
 * ERC20 TokenVault Verification Module
 *
 * This module contains functions for verifying MetaERC20TokenVault contract configurations
 * on Ethereum networks. It handles stETH and wETH vault verification, token configuration,
 * and parameter consistency checks for ERC20-based token vaults.
 */
/* eslint-disable no-await-in-loop, no-restricted-syntax */
import { type HardhatRuntimeEnvironment } from 'hardhat/types';

import type { ContractsMetaEth } from '@molecula-monorepo/blockchain.addresses';
import { rsETHAddresses, renzoContractAddresses } from '@molecula-monorepo/blockchain.addresses';

import { NATIVE_TOKEN } from '../../../configs';
import type { MetaEthNetworkConfig } from '../../../configs/metaETH/metaEthTypes';
import type {
    MetaERC20TokenVault,
    WeETHTokenVault,
    RsETHTokenVault,
    EzETHTokenVault,
    MetaNativeTokenVault,
} from '../../../typechain-types';
import type { VerificationResult } from '../../utils/configurationVerificationUtils';
import { checkValue } from '../../utils/configurationVerificationUtils';

import { verifyTokenVault } from '../../verify';

export async function verifyStETHVault(
    hre: HardhatRuntimeEnvironment,
    contracts: ContractsMetaEth,
    config: MetaEthNetworkConfig,
): Promise<VerificationResult[]> {
    const vault: MetaERC20TokenVault = await hre.ethers.getContractAt(
        'MetaERC20TokenVault',
        contracts.eth.stETHVault,
    );

    const results = await verifyTokenVault(vault, {
        owner: config.OWNER,
        supplyManager: contracts.eth.supplyManagerV2,
        guardian: config.GUARDIAN,
        tokenAddress: config.stETH,
        minDepositAssets: config.MIN_DEPOSIT_ETH,
        minRedeemShares: config.MIN_REDEEM_SHARES,
        rebaseTokenV2: contracts.eth.metaETH,
    });

    return results;
}

export async function verifyWETHVault(
    hre: HardhatRuntimeEnvironment,
    contracts: ContractsMetaEth,
    config: MetaEthNetworkConfig,
): Promise<VerificationResult[]> {
    const vault: MetaERC20TokenVault = await hre.ethers.getContractAt(
        'MetaERC20TokenVault',
        contracts.eth.wETHVault,
    );
    const results = await verifyTokenVault(vault, {
        owner: config.OWNER,
        supplyManager: contracts.eth.supplyManagerV2,
        guardian: config.GUARDIAN,
        tokenAddress: config.wETH,
        minDepositAssets: config.MIN_DEPOSIT_ETH,
        minRedeemShares: config.MIN_REDEEM_SHARES,
        rebaseTokenV2: contracts.eth.metaETH,
    });

    return results;
}

export async function verifyWeETHVault(
    hre: HardhatRuntimeEnvironment,
    contracts: ContractsMetaEth,
    config: MetaEthNetworkConfig,
): Promise<VerificationResult[]> {
    const vault: WeETHTokenVault = await hre.ethers.getContractAt(
        'WeETHTokenVault',
        contracts.eth.weETHVault,
    );
    const results = await verifyTokenVault(vault, {
        owner: config.OWNER,
        supplyManager: contracts.eth.supplyManagerV2,
        guardian: config.GUARDIAN,
        tokenAddress: config.weETH,
        minDepositAssets: config.MIN_DEPOSIT_weETH,
        minRedeemShares: config.MIN_REDEEM_SHARES,
        rebaseTokenV2: contracts.eth.metaETH,
    });

    return results;
}

export async function verifyRsETHVault(
    hre: HardhatRuntimeEnvironment,
    contracts: ContractsMetaEth,
    config: MetaEthNetworkConfig,
): Promise<VerificationResult[]> {
    const vault: RsETHTokenVault = await hre.ethers.getContractAt(
        'RsETHTokenVault',
        contracts.eth.rsETHVault,
    );
    const results = await verifyTokenVault(vault, {
        owner: config.OWNER,
        supplyManager: contracts.eth.supplyManagerV2,
        guardian: config.GUARDIAN,
        tokenAddress: config.rsETH,
        minDepositAssets: config.MIN_DEPOSIT_rsETH,
        minRedeemShares: config.MIN_REDEEM_SHARES,
        rebaseTokenV2: contracts.eth.metaETH,
    });

    // Unique: LRT oracle
    const oracle = await vault.LRT_ORACLE();
    results.push({
        variableName: 'LRT_ORACLE',
        ...checkValue(rsETHAddresses.LRTOracle, oracle),
    });

    return results;
}

export async function verifyEzETHVault(
    hre: HardhatRuntimeEnvironment,
    contracts: ContractsMetaEth,
    config: MetaEthNetworkConfig,
): Promise<VerificationResult[]> {
    const vault: EzETHTokenVault = await hre.ethers.getContractAt(
        'EzETHTokenVault',
        contracts.eth.ezETHVault,
    );
    const results = await verifyTokenVault(vault, {
        owner: config.OWNER,
        supplyManager: contracts.eth.supplyManagerV2,
        guardian: config.GUARDIAN,
        tokenAddress: config.ezETH,
        minDepositAssets: config.MIN_DEPOSIT_ezETH,
        minRedeemShares: config.MIN_REDEEM_SHARES,
        rebaseTokenV2: contracts.eth.metaETH,
    });

    // Unique: RESTAKE_MANAGER
    const manager = await vault.RESTAKE_MANAGER();
    results.push({
        variableName: 'RESTAKE_MANAGER',
        ...checkValue(renzoContractAddresses.restakeManager, manager),
    });

    return results;
}

export async function verifyNativeTokenVault(
    hre: HardhatRuntimeEnvironment,
    contracts: ContractsMetaEth,
    config: MetaEthNetworkConfig,
): Promise<VerificationResult[]> {
    const vault: MetaNativeTokenVault = await hre.ethers.getContractAt(
        'MetaNativeTokenVault',
        contracts.eth.nativeTokenVault,
    );
    const results = await verifyTokenVault(vault, {
        owner: config.OWNER,
        supplyManager: contracts.eth.supplyManagerV2,
        guardian: config.GUARDIAN,
        tokenAddress: NATIVE_TOKEN,
        minDepositAssets: config.MIN_DEPOSIT_ETH,
        minRedeemShares: config.MIN_REDEEM_SHARES,
        rebaseTokenV2: contracts.eth.metaETH,
    });

    return results;
}
