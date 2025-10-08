/* eslint-disable no-await-in-loop, no-restricted-syntax, no-plusplus */
import { type HardhatRuntimeEnvironment } from 'hardhat/types';

import type { EnvironmentType, ContractsMrEth } from '@molecula-monorepo/blockchain.addresses';

import type { ContractVerification } from '../../utils/configurationVerificationUtils';
import {
    failVerificationResult,
    printVerificationResults,
} from '../../utils/configurationVerificationUtils';
import { getMrEthConfig, readFromFile } from '../../utils/deployUtils';

import { verifyCoreV2 } from './verifyCoreV2';
import { verifyDepositManagerPool } from './verifyDepositManagerPool';

/**
 * Verifies MrETH contract configuration (CoreV2 and DepositManagerPool)
 * Loads configuration and deployed contracts, then verifies all contract states
 * @param hre - Hardhat runtime environment
 * @param environment - Environment type (devnet, mainnet/beta, mainnet/prod)
 */
export async function verifyMrEth(
    hre: HardhatRuntimeEnvironment,
    environment: EnvironmentType,
): Promise<void> {
    console.log('\n🔍 Verifying MrETH protocol configuration');
    console.log('Environment:', environment);
    console.log('Network:', hre.network.name);

    const { config } = await getMrEthConfig(hre, environment, hre.network.name);

    const contractsMrEth: ContractsMrEth = await readFromFile(
        `${environment}/contracts_mr_eth.json`,
    );
    if (!contractsMrEth || !contractsMrEth.eth) {
        throw new Error('Failed to load MrETH contracts or missing Ethereum contracts');
    }

    const verificationResults: ContractVerification[] = [];

    // Verify CoreV2 suite (SupplyManagerV2, mrETH token, vaults)
    console.log('\n📋 Starting CoreV2 verification...');
    try {
        const coreV2Verifications = await verifyCoreV2(hre, contractsMrEth, environment);
        verificationResults.push(...coreV2Verifications);
        console.log('CoreV2 verification completed');
    } catch (error) {
        console.error('CoreV2 verification failed:', error);
        verificationResults.push({
            contractAddress: 'CoreV2',
            contractName: 'MrETH CoreV2',
            results: [failVerificationResult(error)],
        });
    }

    // Verify DepositManagerPool configuration
    console.log('\n📋 Starting DepositManagerPool verification...');
    try {
        const depositManagerPoolResults = await verifyDepositManagerPool(
            hre,
            contractsMrEth,
            config,
        );
        verificationResults.push(depositManagerPoolResults);
        console.log('DepositManagerPool verification completed');
    } catch (error) {
        console.error('DepositManagerPool verification failed:', error);
        verificationResults.push({
            contractAddress: contractsMrEth.eth.depositManagerPool,
            contractName: 'DepositManagerPool',
            results: [failVerificationResult(error)],
        });
    }

    // Print verification results
    printVerificationResults(verificationResults);
}
