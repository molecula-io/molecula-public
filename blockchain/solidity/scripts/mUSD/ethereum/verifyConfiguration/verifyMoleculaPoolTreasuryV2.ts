/*
 * MoleculaPoolTreasuryV2 Contract Verification Module
 *
 * This module contains functions for verifying MoleculaPoolTreasuryV2 contract configuration
 * on Ethereum networks. It handles contract state verification, pool parameters,
 * and relationship validation with other Nitrogen contracts.
 */
/* eslint-disable no-await-in-loop, no-restricted-syntax, no-plusplus */
import { type HardhatRuntimeEnvironment } from 'hardhat/types';

import type { ContractsNitrogen } from '@molecula-monorepo/blockchain.addresses';

import type { EthereumNetworkConfig } from '../../../../configs/mUSD/ethereum/types';
import type { MoleculaPoolTreasuryV2 } from '../../../../typechain-types';
import type {
    VerificationResult,
    ContractVerification,
} from '../../../utils/configurationVerificationUtils';
import { checkValue } from '../../../utils/configurationVerificationUtils';

/**
 * Verifies MoleculaPoolTreasuryV2 contract configuration
 * Checks contract state variables, pool parameters, and relationships with other contracts
 * @param hre - Hardhat runtime environment
 * @param contractsNitrogen - Deployed Nitrogen contracts object
 * @param config - Configuration object with expected values
 * @returns ContractVerification object with verification results
 */
export async function verifyMoleculaPoolTreasuryV2Contract(
    hre: HardhatRuntimeEnvironment,
    contractsNitrogen: ContractsNitrogen,
    config: EthereumNetworkConfig,
): Promise<ContractVerification> {
    console.log(
        `\n📋 Verifying MoleculaPoolTreasuryV2 contract: ${contractsNitrogen.eth.moleculaPool}`,
    );

    const moleculaPoolTreasuryV2: MoleculaPoolTreasuryV2 = await hre.ethers.getContractAt(
        'MoleculaPoolTreasuryV2',
        contractsNitrogen.eth.moleculaPool,
    );
    const results: VerificationResult[] = [];

    // Verify owner of the contract
    const actualOwner = await moleculaPoolTreasuryV2.owner();
    results.push({
        variableName: 'owner',
        ...checkValue(config.OWNER, actualOwner),
    });

    // Verify poolKeeper address
    const actualPoolKeeper = await moleculaPoolTreasuryV2.poolKeeper();
    results.push({
        variableName: 'poolKeeper',
        ...checkValue(config.POOL_KEEPER, actualPoolKeeper),
    });

    // Verify supplyManager address
    const actualSupplyManager = await moleculaPoolTreasuryV2.SUPPLY_MANAGER();
    results.push({
        variableName: 'supplyManager',
        ...checkValue(contractsNitrogen.eth.supplyManager, actualSupplyManager),
    });

    // Verify guardian address
    const actualGuardian = await moleculaPoolTreasuryV2.guardian();
    results.push({
        variableName: 'guardian',
        ...checkValue(config.GUARDIAN_ADDRESS, actualGuardian),
    });

    // Verify priceChecker address (should be zero address based on deployment)
    const actualPriceChecker = await moleculaPoolTreasuryV2.priceChecker();
    results.push({
        variableName: 'priceChecker',
        ...checkValue(hre.ethers.ZeroAddress, actualPriceChecker),
    });

    // Verify pool tokens using getTokenPool()
    const actualTokenPool = await moleculaPoolTreasuryV2.getTokenPool();
    const expectedTokensCount =
        config.MOLECULA_POOL_TOKENS.length + (contractsNitrogen.eth.mUSDe !== '' ? 1 : 0);
    results.push({
        variableName: 'poolTokensCount',
        ...checkValue(expectedTokensCount, actualTokenPool.length),
    });

    // Verify that all expected pool tokens present
    config.MOLECULA_POOL_TOKENS.forEach((token, index) => {
        const expectedToken = token.token;
        const actualToken = actualTokenPool[index]!.token;
        results.push({
            variableName: `poolTokens[${index}]`,
            ...checkValue(expectedToken, actualToken),
        });
    });

    // Verify mUSDe token if it exists
    if (contractsNitrogen.eth.mUSDe !== '') {
        const mUSDeIndex = config.MOLECULA_POOL_TOKENS.length;
        const mUSDeToken = actualTokenPool[mUSDeIndex];
        if (mUSDeToken) {
            const actualMUSDe = mUSDeToken.token;
            results.push({
                variableName: `poolTokens[${mUSDeIndex}] (mUSDe)`,
                ...checkValue(contractsNitrogen.eth.mUSDe, actualMUSDe),
            });
        }
    }

    return {
        contractAddress: contractsNitrogen.eth.moleculaPool,
        contractName: 'MoleculaPoolTreasuryV2',
        results,
    };
}
