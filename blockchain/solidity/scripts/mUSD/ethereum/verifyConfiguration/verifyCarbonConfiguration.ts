/* eslint-disable no-await-in-loop, no-restricted-syntax, no-plusplus */
import { type HardhatRuntimeEnvironment } from 'hardhat/types';

import type {
    EnvironmentType,
    ContractsCarbon,
    ContractsExecutor,
} from '@molecula-monorepo/blockchain.addresses';

import type { ContractVerification } from '../../../utils/configurationVerificationUtils';
import {
    failVerificationResult,
    printVerificationResults,
} from '../../../utils/configurationVerificationUtils';

import { getConfig, readFromFile } from '../../../utils/deployUtils';

import { verifyAgentLZContract } from './verifyAgentLZ';
import { verifyExecutorContract } from './verifyExecutor';
import { verifySupplyManagerAgent } from './verifySupplyManager';

/**
 * Verifies Carbon and Executor contract configuration against expected config values
 * Main entry point for contract verification on Ethereum network
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
    const { config } = await getConfig(hre, environment);

    // Read deployed contracts with error handling
    const contractsCarbon: ContractsCarbon = await readFromFile(
        `${environment}/contracts_carbon.json`,
    );
    if (!contractsCarbon || !contractsCarbon.eth) {
        throw new Error('Failed to load Carbon contracts or missing Ethereum contracts');
    }

    const verificationResults: ContractVerification[] = [];

    // Verify AgentLZ contract
    if (contractsCarbon.eth.agentLZ) {
        console.log('\n📋 Starting AgentLZ verification...');
        try {
            const agentLZVerification = await verifyAgentLZContract(
                hre,
                contractsCarbon,
                config,
                environment,
            );
            verificationResults.push(agentLZVerification);
            console.log('AgentLZ verification completed');
        } catch (error) {
            console.error('AgentLZ verification failed:', error);
            verificationResults.push({
                contractAddress: contractsCarbon.eth.agentLZ,
                contractName: 'AgentLZ',
                results: [failVerificationResult(error)],
            });
        }
    } else {
        console.log('⚠️ AgentLZ contract not found');
    }

    // Verify SupplyManager contract
    if (contractsCarbon.eth.supplyManager) {
        console.log('\n📋 Starting SupplyManager verification...');
        try {
            const supplyManagerVerification = await verifySupplyManagerAgent(
                hre,
                contractsCarbon.eth.supplyManager,
                contractsCarbon.eth.agentLZ,
            );
            verificationResults.push(supplyManagerVerification);
            console.log('SupplyManager verification completed');
        } catch (error) {
            console.error('SupplyManager verification failed:', error);
            verificationResults.push({
                contractAddress: contractsCarbon.eth.supplyManager,
                contractName: 'SupplyManager',
                results: [failVerificationResult(error)],
            });
        }
    } else {
        console.log('⚠️ SupplyManager contract not found');
    }

    // Verify Executor contracts
    const contractsExecutor: ContractsExecutor = await readFromFile(
        `${environment}/contracts_executor.json`,
    );

    // Verify Executor contract
    if (contractsExecutor.eth.executor) {
        console.log('\n📋 Starting Executor verification...');
        try {
            const executorVerification = await verifyExecutorContract(
                hre,
                contractsExecutor.eth.executor,
                config,
            );
            verificationResults.push(executorVerification);
            console.log('Executor verification completed');
        } catch (error) {
            console.error('Executor verification failed:', error);
            verificationResults.push({
                contractAddress: contractsExecutor.eth.executor,
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
