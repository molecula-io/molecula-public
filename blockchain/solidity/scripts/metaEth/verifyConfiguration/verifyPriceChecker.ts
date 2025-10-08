/*
 * PriceChecker Contract Verification Module
 *
 * This module contains functions for verifying PriceChecker contract configuration
 * on Ethereum networks. It handles price feed verification, deviation threshold validation,
 * and parameter consistency checks for the PriceChecker contract.
 */
/* eslint-disable no-await-in-loop, no-restricted-syntax, no-plusplus */
import { type HardhatRuntimeEnvironment } from 'hardhat/types';

import type { EnvironmentType, ContractsMetaEth } from '@molecula-monorepo/blockchain.addresses';

import type { MetaEthNetworkConfig } from '../../../configs/metaETH/metaEthTypes';
import type {
    VerificationResult,
    ContractVerification,
} from '../../utils/configurationVerificationUtils';
import { checkValue } from '../../utils/configurationVerificationUtils';
import { getFeeds, getChainId } from '../utils';

export async function verifyPriceCheckerContract(
    hre: HardhatRuntimeEnvironment,
    contracts: ContractsMetaEth,
    config: MetaEthNetworkConfig,
    environment: EnvironmentType,
    withPoolTokens: boolean,
): Promise<ContractVerification> {
    const priceChecker = await hre.ethers.getContractAt('PriceChecker', contracts.eth.priceChecker);
    const results: VerificationResult[] = [];

    const actualOwner = await priceChecker.owner();
    results.push({
        variableName: 'owner',
        ...checkValue(config.OWNER, actualOwner),
    });

    // Verify MOLECULA_TOKEN_DECIMALS (immutable)
    const actualMoleculaTokenDecimals = await priceChecker.MOLECULA_TOKEN_DECIMALS();
    results.push({
        variableName: 'MOLECULA_TOKEN_DECIMALS',
        ...checkValue(config.META_ETH_TOKEN_DECIMALS, actualMoleculaTokenDecimals),
    });

    // Verify price feeds configuration
    const chainIdEnum = getChainId(environment);
    const expectedFeeds = getFeeds(hre, config, chainIdEnum, withPoolTokens);

    for (let i = 0; i < expectedFeeds.length; i++) {
        const expectedFeed = expectedFeeds[i]!;

        // Get the checker info for this asset from the contract
        const checkerInfo = await priceChecker.checkers(expectedFeed.asset);

        results.push({
            variableName: `feed[${i}].priceFeed`,
            ...checkValue(expectedFeed.priceFeed, checkerInfo.priceFeed),
        });

        results.push({
            variableName: `feed[${i}].priceDeviationBps`,
            ...checkValue(expectedFeed.priceDeviationBps, checkerInfo.priceDeviationBps),
        });

        results.push({
            variableName: `feed[${i}].stalenessThreshold`,
            ...checkValue(expectedFeed.stalenessThreshold, checkerInfo.stalenessThreshold),
        });

        results.push({
            variableName: `feed[${i}].isPresent`,
            ...checkValue(true, checkerInfo.isPresent),
        });
    }

    return { contractAddress: contracts.eth.priceChecker, contractName: 'PriceChecker', results };
}
