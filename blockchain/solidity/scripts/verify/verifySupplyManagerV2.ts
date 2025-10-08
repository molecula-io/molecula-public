/*
 * SupplyManagerV2 Contract Verification Module
 *
 * This module contains functions for verifying SupplyManagerV2WithNative contract configuration
 * on Ethereum networks. It handles supply manager state verification, yield distribution validation,
 * and parameter consistency checks for the SupplyManagerV2 contract.
 */
/* eslint-disable no-await-in-loop, no-restricted-syntax, no-plusplus */
import { type HardhatRuntimeEnvironment } from 'hardhat/types';

import { ETH_VIRTUAL_OFFSET } from '../../configs';

import type {
    VerificationResult,
    ContractVerification,
} from '../utils/configurationVerificationUtils';
import { checkValue, failVerificationResult } from '../utils/configurationVerificationUtils';

// Common expectations for any supply manager v2
export type CommonSupplyManagerV2Expectations = {
    owner: string;
    yieldDistributor: string;
    moleculaPool: string;
    apyFormatter: number;
    moleculaToken: string;
};

export async function verifySupplyManagerV2(
    hre: HardhatRuntimeEnvironment,
    supplyManagerV2Address: string,
    config: CommonSupplyManagerV2Expectations,
): Promise<ContractVerification> {
    const supplyManagerV2 = await hre.ethers.getContractAt(
        'SupplyManagerV2WithNative',
        supplyManagerV2Address,
    );
    const results: VerificationResult[] = [];

    try {
        const actualOwner = await supplyManagerV2.owner();
        results.push({
            variableName: 'owner',
            ...checkValue(config.owner, actualOwner),
        });

        const actualYieldDistributor = await supplyManagerV2.yieldDistributor();
        results.push({
            variableName: 'yieldDistributor',
            ...checkValue(config.yieldDistributor, actualYieldDistributor),
        });

        const actualMoleculaPool = await supplyManagerV2.getMoleculaPool();
        results.push({
            variableName: '_MOLECULA_POOL',
            ...checkValue(config.moleculaPool, actualMoleculaPool),
        });

        const actualApy = await supplyManagerV2.apyFormatter();
        results.push({
            variableName: 'apyFormatter',
            ...checkValue(config.apyFormatter, actualApy),
        });

        const actualToken = await supplyManagerV2.MOLECULA_TOKEN();
        results.push({
            variableName: 'MOLECULA_TOKEN',
            ...checkValue(config.moleculaToken, actualToken),
        });

        const actualVirtualOffset = await supplyManagerV2.VIRTUAL_OFFSET();
        results.push({
            variableName: 'VIRTUAL_OFFSET',
            ...checkValue(ETH_VIRTUAL_OFFSET, actualVirtualOffset),
        });
    } catch (error) {
        results.push(failVerificationResult(error));
    }

    return {
        contractAddress: supplyManagerV2Address,
        contractName: 'SupplyManagerV2',
        results,
    };
}
