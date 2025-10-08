/* eslint-disable no-await-in-loop, no-restricted-syntax */
import { type HardhatRuntimeEnvironment } from 'hardhat/types';

import type { EnvironmentType, ContractsMetaEth } from '@molecula-monorepo/blockchain.addresses';

import type { ContractVerification } from '../../utils/configurationVerificationUtils';
import {
    printVerificationResults,
    failVerificationResult,
} from '../../utils/configurationVerificationUtils';
import { readFromFile } from '../../utils/deployUtils';

import { verifySupplyManagerV2 } from '../../verify';
import { getMetaEthConfig } from '../utils';

import { verifyMetaPoolTreasuryContract } from './verifyMetaPoolTreasury';
import { verifyPriceCheckerContract } from './verifyPriceChecker';
import { verifyRebaseTokenV2Contract } from './verifyRebaseTokenV2';
import {
    verifyStETHVault,
    verifyWETHVault,
    verifyWeETHVault,
    verifyRsETHVault,
    verifyEzETHVault,
    verifyNativeTokenVault,
} from './verifyTokenVault';
import { verifyWmetaETHContract } from './verifyWmetaETH';

export async function verifyMetaEth(
    hre: HardhatRuntimeEnvironment,
    environment: EnvironmentType,
): Promise<void> {
    const { config, account } = await getMetaEthConfig(hre, environment);

    const contracts: ContractsMetaEth = await readFromFile(
        `${environment}/contracts_meta_eth.json`,
    );

    const verificationResults: ContractVerification[] = [];

    console.log('\n📋 Starting MetaPoolTreasury verification...');
    try {
        verificationResults.push(await verifyMetaPoolTreasuryContract(hre, contracts, config));
        console.log('MetaPoolTreasury verification completed');
    } catch (error) {
        console.error('MetaPoolTreasury verification failed:', error);
        verificationResults.push({
            contractAddress: contracts.eth.metaPoolTreasury,
            contractName: 'MetaPoolTreasury',
            results: [failVerificationResult(error)],
        });
    }

    console.log('\n📋 Starting SupplyManagerV2 verification...');
    verificationResults.push(
        await verifySupplyManagerV2(hre, contracts.eth.supplyManagerV2, {
            owner: config.OWNER,
            yieldDistributor: config.YIELD_DISTRIBUTOR,
            moleculaPool: contracts.eth.metaPoolTreasury,
            apyFormatter: config.APY,
            moleculaToken: contracts.eth.metaETH,
        }),
    );
    console.log('SupplyManagerV2 verification completed');

    console.log('\n📋 Starting RebaseTokenV2 verification...');
    try {
        verificationResults.push(
            await verifyRebaseTokenV2Contract(hre, contracts, config, account.address),
        );
        console.log('RebaseTokenV2 verification completed');
    } catch (error) {
        console.error('RebaseTokenV2 verification failed:', error);
        verificationResults.push({
            contractAddress: contracts.eth.metaETH,
            contractName: 'RebaseTokenV2',
            results: [failVerificationResult(error)],
        });
    }

    console.log('\n📋 Starting wmetaETH verification...');
    try {
        verificationResults.push(await verifyWmetaETHContract(hre, contracts, config));
        console.log('wmetaETH verification completed');
    } catch (error) {
        console.error('wmetaETH verification failed:', error);
        verificationResults.push({
            contractAddress: contracts.eth.wmetaETH,
            contractName: 'RewardBearingWrapper',
            results: [failVerificationResult(error)],
        });
    }

    console.log('\n📋 Starting PriceChecker verification...');
    try {
        verificationResults.push(
            await verifyPriceCheckerContract(
                hre,
                contracts,
                config,
                environment,
                config.weETH !== '0x',
            ),
        );
        console.log('PriceChecker verification completed');
    } catch (error) {
        console.error('PriceChecker verification failed:', error);
        verificationResults.push({
            contractAddress: contracts.eth.priceChecker,
            contractName: 'PriceChecker',
            results: [failVerificationResult(error)],
        });
    }

    // Verify TokenVaults individually
    if (contracts.eth.stETHVault) {
        console.log('\n📋 Starting stETHVault verification...');
        verificationResults.push({
            contractAddress: contracts.eth.stETHVault,
            contractName: 'stETHVault',
            results: await verifyStETHVault(hre, contracts, config),
        });
        console.log('stETHVault verification completed');
    }

    if (contracts.eth.wETHVault) {
        console.log('\n📋 Starting wETHVault verification...');
        verificationResults.push({
            contractAddress: contracts.eth.wETHVault,
            contractName: 'wETHVault',
            results: await verifyWETHVault(hre, contracts, config),
        });
        console.log('wETHVault verification completed');
    }

    if (contracts.eth.nativeTokenVault) {
        console.log('\n📋 Starting NativeTokenVault verification...');
        verificationResults.push({
            contractAddress: contracts.eth.nativeTokenVault,
            contractName: 'NativeTokenVault',
            results: await verifyNativeTokenVault(hre, contracts, config),
        });
        console.log('NativeTokenVault verification completed');
    }

    if (contracts.eth.weETHVault) {
        console.log('\n📋 Starting WeETHTokenVault verification...');
        verificationResults.push({
            contractAddress: contracts.eth.weETHVault,
            contractName: 'WeETHTokenVault',
            results: await verifyWeETHVault(hre, contracts, config),
        });
        console.log('WeETHTokenVault verification completed');
    }

    if (contracts.eth.rsETHVault) {
        console.log('\n📋 Starting RsETHTokenVault verification...');
        verificationResults.push({
            contractAddress: contracts.eth.rsETHVault,
            contractName: 'RsETHTokenVault',
            results: await verifyRsETHVault(hre, contracts, config),
        });
        console.log('RsETHTokenVault verification completed');
    }

    if (contracts.eth.ezETHVault) {
        console.log('\n📋 Starting EzETHTokenVault verification...');
        verificationResults.push({
            contractAddress: contracts.eth.ezETHVault,
            contractName: 'EzETHTokenVault',
            results: await verifyEzETHVault(hre, contracts, config),
        });
        console.log('EzETHTokenVault verification completed');
    }

    // Print verification results
    printVerificationResults(verificationResults);
}
