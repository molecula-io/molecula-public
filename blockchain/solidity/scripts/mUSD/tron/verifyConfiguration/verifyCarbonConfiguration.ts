/* eslint-disable no-await-in-loop, no-restricted-syntax, no-plusplus */
import { type HardhatRuntimeEnvironment } from 'hardhat/types';

import type {
    EnvironmentType,
    ContractsCarbon,
    ContractsExecutor,
} from '@molecula-monorepo/blockchain.addresses';

import { DOUBLE_DELAY } from '../../../../configs';
import {
    printVerificationResults,
    addDelay,
    type ContractVerification,
    failVerificationResult,
} from '../../../utils/configurationVerificationUtils';
import { getTronEnvironmentConfig, readFromFile } from '../../../utils/deployUtils';

import { verifyAccountantLZContract } from './verifyAccountantLZ';
import { verifyExecutorContract } from './verifyExecutor';
import { verifyOracleContract } from './verifyOracle';
import { verifyRebaseTokenContract } from './verifyRebaseToken';

/**
 * Verifies Carbon and Executor Tron contract configuration against expected config values
 * Main entry point for contract verification on Tron network with comprehensive error handling
 * Loads configuration and deployed contracts, then verifies all contract states
 * @param hre - Hardhat runtime environment
 * @param environment - Environment type (devnet, mainnet/beta, mainnet/prod)
 * @returns Promise that resolves when verification is complete
 */
export async function verifyCarbonConfiguration(
    hre: HardhatRuntimeEnvironment,
    environment: EnvironmentType,
): Promise<void> {
    console.log('\n🔍 Verifying Carbon protocol Configuration');
    console.log('Environment:', environment);
    console.log('Network:', hre.network.name);

    // Load configuration with error handling
    const config = getTronEnvironmentConfig(environment);

    // Read deployed contracts with error handling
    const contractsCarbon: ContractsCarbon = await readFromFile(
        `${environment}/contracts_carbon.json`,
    );

    const verificationResults: ContractVerification[] = [];

    // Verify AccountantLZ contract
    if (contractsCarbon.tron.accountantLZ) {
        console.log('\nStarting AccountantLZ verification...');
        try {
            const accountantLZVerification = await verifyAccountantLZContract(
                hre,
                contractsCarbon.tron.accountantLZ,
                config,
                environment,
                contractsCarbon,
            );
            verificationResults.push(accountantLZVerification);
            console.log('AccountantLZ verification completed');
        } catch (error) {
            console.error('AccountantLZ verification failed:', error);
            verificationResults.push({
                contractAddress: contractsCarbon.tron.accountantLZ,
                contractName: 'AccountantLZ',
                results: [failVerificationResult(error)],
            });
        }

        // Delay for better readability and rate limiting
        await addDelay(DOUBLE_DELAY);
    } else {
        console.log('⚠️ AccountantLZ contract not found');
    }

    // Verify Oracle contract
    if (contractsCarbon.tron.oracle) {
        console.log('\nStarting Oracle verification...');
        try {
            const oracleVerification = await verifyOracleContract(
                hre,
                contractsCarbon.tron.oracle,
                config,
                contractsCarbon,
            );
            verificationResults.push(oracleVerification);
            console.log('Oracle verification completed');
        } catch (error) {
            console.error('Oracle verification failed:', error);
            verificationResults.push({
                contractAddress: contractsCarbon.tron.oracle,
                contractName: 'Oracle',
                results: [failVerificationResult(error)],
            });
        }

        // Delay for better readability and rate limiting
        await addDelay(DOUBLE_DELAY);
    } else {
        console.log('⚠️ Oracle contract not found');
    }

    // Verify RebaseToken contract
    if (contractsCarbon.tron.rebaseToken) {
        console.log('\nStarting RebaseToken verification...');
        try {
            const rebaseTokenVerification = await verifyRebaseTokenContract(
                hre,
                contractsCarbon.tron.rebaseToken,
                config,
                contractsCarbon,
            );
            verificationResults.push(rebaseTokenVerification);
            console.log('RebaseToken verification completed');
        } catch (error) {
            console.error('RebaseToken verification failed:', error);
            verificationResults.push({
                contractAddress: contractsCarbon.tron.rebaseToken,
                contractName: 'RebaseToken',
                results: [failVerificationResult(error)],
            });
        }

        // Delay for better readability and rate limiting
        await addDelay(DOUBLE_DELAY);
    } else {
        console.log('⚠️ RebaseToken contract not found');
    }

    // Verify Executor contracts
    const contractsExecutor: ContractsExecutor = await readFromFile(
        `${environment}/contracts_executor.json`,
    );

    // Verify Executor contract
    if (contractsExecutor.tron.executor) {
        console.log('\nStarting Executor verification...');
        try {
            const executorVerification = await verifyExecutorContract(
                hre,
                contractsExecutor.tron.executor,
                config,
                contractsExecutor,
            );
            verificationResults.push(executorVerification);
            console.log('Executor verification completed');
        } catch (error) {
            console.error('Executor verification failed:', error);
            verificationResults.push({
                contractAddress: contractsExecutor.tron.executor,
                contractName: 'Executor',
                results: [failVerificationResult(error)],
            });
        }
    } else {
        console.log('⚠️ Executor contract not found');
    }

    // Print verification results
    printVerificationResults(verificationResults);
}
