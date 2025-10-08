/*
 * SupplyManager Contract Verification Module
 *
 * This module contains functions for verifying SupplyManager contract configuration
 * on Ethereum networks. It handles contract state verification, agent authorization,
 * and relationship validation with other Nitrogen contracts.
 */
/* eslint-disable no-await-in-loop, no-restricted-syntax */
import { type HardhatRuntimeEnvironment } from 'hardhat/types';

import type { ContractsNitrogen } from '@molecula-monorepo/blockchain.addresses';

import type { EthereumNetworkConfig } from '../../../../configs/mUSD/ethereum/types';
import type { SupplyManager } from '../../../../typechain-types';
import type {
    VerificationResult,
    ContractVerification,
} from '../../../utils/configurationVerificationUtils';
import { checkValue } from '../../../utils/configurationVerificationUtils';

/**
 * Verifies SupplyManager's agent configuration
 * Ensures AgentLZ is registered as an authorized agent
 * @param hre - Hardhat runtime environment
 * @param supplyManagerAddress - Deployed contracts object
 * @param agentAddress - Deployed contracts object
 * @returns ContractVerification object with verification results
 */
export async function verifySupplyManagerAgent(
    hre: HardhatRuntimeEnvironment,
    supplyManagerAddress: string,
    agentAddress: string,
): Promise<ContractVerification> {
    console.log(`\n📋 Verifying SupplyManager contract: ${supplyManagerAddress}`);

    const results: VerificationResult[] = [];

    const supplyManager = await hre.ethers.getContractAt('SupplyManager', supplyManagerAddress);

    const isAgent = await supplyManager.agents(agentAddress);
    results.push({
        variableName: `Agent address: ${agentAddress} is authorized agent`,
        ...checkValue(true, isAgent),
    });

    return {
        contractAddress: supplyManagerAddress,
        contractName: 'SupplyManager',
        results,
    };
}

/**
 * Verifies SupplyManager contract configuration
 * Checks contract state variables, agent authorization, and relationships with other contracts
 * @param hre - Hardhat runtime environment
 * @param contractsNitrogen - Deployed Nitrogen contracts object
 * @param config - Configuration object with expected values
 * @returns ContractVerification object with verification results
 */
export async function verifySupplyManagerContract(
    hre: HardhatRuntimeEnvironment,
    contractsNitrogen: ContractsNitrogen,
    config: EthereumNetworkConfig,
): Promise<ContractVerification> {
    console.log(`\n📋 Verifying SupplyManager contract: ${contractsNitrogen.eth.supplyManager}`);

    const supplyManager: SupplyManager = await hre.ethers.getContractAt(
        'SupplyManager',
        contractsNitrogen.eth.supplyManager,
    );
    const results: VerificationResult[] = [];

    // Verify owner of the contract
    const actualOwner = await supplyManager.owner();
    results.push({
        variableName: 'owner',
        ...checkValue(config.OWNER, actualOwner),
    });

    // Verify moleculaPool address
    const actualMoleculaPool = await supplyManager.getMoleculaPool();
    results.push({
        variableName: 'moleculaPool',
        ...checkValue(contractsNitrogen.eth.moleculaPool, actualMoleculaPool),
    });

    // Verify authorizedYieldDistributor address
    const actualYieldDistributor = await supplyManager.authorizedYieldDistributor();
    results.push({
        variableName: 'authorizedYieldDistributor',
        ...checkValue(config.POOL_KEEPER, actualYieldDistributor),
    });

    // Verify apyFormatter (should be 0 for Nitrogen)
    const actualApyFormatter = await supplyManager.apyFormatter();
    results.push({
        variableName: 'apyFormatter',
        ...checkValue(config.APY_FORMATTER, actualApyFormatter),
    });

    // Verify AccountantAgent is authorized
    const accountantAgentVerification = await verifySupplyManagerAgent(
        hre,
        contractsNitrogen.eth.supplyManager,
        contractsNitrogen.eth.accountantAgent,
    );
    results.push(...accountantAgentVerification.results);

    return {
        contractAddress: contractsNitrogen.eth.supplyManager,
        contractName: 'SupplyManager',
        results,
    };
}
