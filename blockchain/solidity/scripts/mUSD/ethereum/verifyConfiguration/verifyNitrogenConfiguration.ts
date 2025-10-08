/* eslint-disable no-await-in-loop, no-restricted-syntax, no-plusplus */
import { type HardhatRuntimeEnvironment } from 'hardhat/types';

import type {
    EnvironmentType,
    ContractsNitrogen,
    ContractsCore,
} from '@molecula-monorepo/blockchain.addresses';

import type { ContractVerification } from '../../../utils/configurationVerificationUtils';
import {
    failVerificationResult,
    printVerificationResults,
} from '../../../utils/configurationVerificationUtils';

import { getEnvironmentConfig, readFromFile } from '../../../utils/deployUtils';

import { verifyAccountantAgentContract } from './verifyAccountantAgent';
import { verifyMoleculaPoolTreasuryV2Contract } from './verifyMoleculaPoolTreasuryV2';
import { verifyNitrogenTokenVaultContract } from './verifyNitrogenTokenVault';
import { verifyRebaseTokenContract } from './verifyRebaseToken';
import { verifySupplyManagerContract } from './verifySupplyManager';

/**
 * Verifies Nitrogen contract configuration against expected config values
 * Main entry point for contract verification on Ethereum network
 * Loads configuration and deployed contracts, then verifies all contract states
 * @param hre - Hardhat runtime environment
 * @param environment - Environment type (devnet, mainnet/beta, mainnet/prod)
 * @returns Promise that resolves when verification is complete
 */
export async function verifyNitrogenConfiguration(
    hre: HardhatRuntimeEnvironment,
    environment: EnvironmentType,
): Promise<void> {
    console.log('\n🔍 Verifying Nitrogen protocol Configuration');
    console.log('Environment:', environment);
    console.log('Network:', hre.network.name);

    // Load static environment configuration (no on-chain calls)
    const config = getEnvironmentConfig(environment);

    // Read deployed contracts with error handling
    const contractsNitrogen: ContractsNitrogen = await readFromFile(
        `${environment}/contracts_nitrogen.json`,
    );

    if (!contractsNitrogen || !contractsNitrogen.eth) {
        throw new Error('Failed to load Nitrogen contracts or missing Ethereum contracts');
    }

    // Read Core contracts for cross-references
    const contractsCore: ContractsCore = await readFromFile(`${environment}/contracts_core.json`);
    if (!contractsCore || !contractsCore.eth) {
        throw new Error('Failed to load Core contracts or missing Ethereum contracts');
    }

    const verificationResults: ContractVerification[] = [];

    // Verify AccountantAgent contract
    if (contractsNitrogen.eth.accountantAgent) {
        console.log('\n📋 Starting AccountantAgent verification...');
        try {
            const accountantAgentVerification = await verifyAccountantAgentContract(
                hre,
                contractsNitrogen,
                config,
            );
            verificationResults.push(accountantAgentVerification);
            console.log('AccountantAgent verification completed');
        } catch (error) {
            console.error('AccountantAgent verification failed:', error);
            verificationResults.push({
                contractAddress: contractsNitrogen.eth.accountantAgent,
                contractName: 'AccountantAgent',
                results: [failVerificationResult(error)],
            });
        }
    } else {
        console.log('⚠️ AccountantAgent contract not found');
    }

    // Verify RebaseToken contract
    if (contractsNitrogen.eth.rebaseToken) {
        console.log('\n📋 Starting RebaseToken verification...');
        try {
            const rebaseTokenVerification = await verifyRebaseTokenContract(
                hre,
                contractsNitrogen,
                config,
            );
            verificationResults.push(rebaseTokenVerification);
            console.log('RebaseToken verification completed');
        } catch (error) {
            console.error('RebaseToken verification failed:', error);
            verificationResults.push({
                contractAddress: contractsNitrogen.eth.rebaseToken,
                contractName: 'RebaseToken',
                results: [failVerificationResult(error)],
            });
        }
    } else {
        console.log('⚠️ RebaseToken contract not found');
    }

    // Verify SupplyManager contract
    if (contractsNitrogen.eth.supplyManager) {
        console.log('\n📋 Starting SupplyManager verification...');
        try {
            const supplyManagerVerification = await verifySupplyManagerContract(
                hre,
                contractsNitrogen,
                config,
            );
            verificationResults.push(supplyManagerVerification);
            console.log('SupplyManager verification completed');
        } catch (error) {
            console.error('SupplyManager verification failed:', error);
            verificationResults.push({
                contractAddress: contractsNitrogen.eth.supplyManager,
                contractName: 'SupplyManager',
                results: [failVerificationResult(error)],
            });
        }
    } else {
        console.log('⚠️ SupplyManager contract not found');
    }

    // Verify NitrogenTokenVault contracts
    if (
        contractsNitrogen.eth.tokenVaults &&
        Object.keys(contractsNitrogen.eth.tokenVaults).length > 0
    ) {
        console.log('\n📋 Starting verification of NitrogenTokenVault contracts...');

        for (const [tokenName, vaultAddress] of Object.entries(contractsNitrogen.eth.tokenVaults)) {
            if (vaultAddress) {
                console.log(`\n📋 Verifying NitrogenTokenVault for ${tokenName}...`);
                const tokenVaultVerification = await verifyNitrogenTokenVaultContract(
                    hre,
                    vaultAddress,
                    tokenName,
                    contractsNitrogen,
                    config,
                );
                verificationResults.push(tokenVaultVerification);
                console.log(`NitrogenTokenVault for ${tokenName} verification completed`);
            }
        }
    } else {
        console.log('⚠️ No NitrogenTokenVault contracts found');
    }

    // Verify MoleculaPoolTreasuryV2 contract
    if (contractsNitrogen.eth.moleculaPool) {
        console.log('\n📋 Starting MoleculaPoolTreasuryV2 verification...');
        try {
            const moleculaPoolVerification = await verifyMoleculaPoolTreasuryV2Contract(
                hre,
                contractsNitrogen,
                config,
            );
            verificationResults.push(moleculaPoolVerification);
            console.log('MoleculaPoolTreasuryV2 verification completed');
        } catch (error) {
            console.error('MoleculaPoolTreasuryV2 verification failed:', error);
            verificationResults.push({
                contractAddress: contractsNitrogen.eth.moleculaPool,
                contractName: 'MoleculaPoolTreasuryV2',
                results: [failVerificationResult(error)],
            });
        }
    } else {
        console.log('⚠️ MoleculaPoolTreasuryV2 contract not found');
    }

    // Print verification results
    printVerificationResults(verificationResults);
}
