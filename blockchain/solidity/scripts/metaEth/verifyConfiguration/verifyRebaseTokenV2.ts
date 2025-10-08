/*
 * RebaseTokenV2 Contract Verification Module
 *
 * This module contains functions for verifying RebaseTokenV2 contract configuration
 * on Ethereum networks. It handles rebase token state verification, oracle validation,
 * and parameter consistency checks for the RebaseTokenV2 contract.
 */
/* eslint-disable no-await-in-loop, no-restricted-syntax, no-plusplus */
import { type HardhatRuntimeEnvironment } from 'hardhat/types';

import type { ContractsMetaEth } from '@molecula-monorepo/blockchain.addresses';

import type { MetaEthNetworkConfig } from '../../../configs/metaETH/metaEthTypes';
import type {
    VerificationResult,
    ContractVerification,
} from '../../utils/configurationVerificationUtils';
import { checkValue } from '../../utils/configurationVerificationUtils';

export async function verifyRebaseTokenV2Contract(
    hre: HardhatRuntimeEnvironment,
    contracts: ContractsMetaEth,
    config: MetaEthNetworkConfig,
    account: string,
): Promise<ContractVerification> {
    const rebaseTokenV2 = await hre.ethers.getContractAt('RebaseTokenV2', contracts.eth.metaETH);
    const results: VerificationResult[] = [];

    const actualSupplyManager = await rebaseTokenV2.SUPPLY_MANAGER();
    results.push({
        variableName: 'SUPPLY_MANAGER',
        ...checkValue(contracts.eth.supplyManagerV2, actualSupplyManager),
    });

    const actualOwner = await rebaseTokenV2.owner();
    results.push({
        variableName: 'owner',
        ...checkValue(account, actualOwner),
    });

    const actualName = await rebaseTokenV2.name();
    results.push({
        variableName: 'name',
        ...checkValue(config.META_ETH_TOKEN_NAME, actualName),
    });

    const actualSymbol = await rebaseTokenV2.symbol();
    results.push({
        variableName: 'symbol',
        ...checkValue(config.META_ETH_TOKEN_SYMBOL, actualSymbol),
    });

    const actualDecimals = await rebaseTokenV2.decimals();
    results.push({
        variableName: 'decimals',
        ...checkValue(config.META_ETH_TOKEN_DECIMALS.toString(), actualDecimals),
    });

    const actualOracle = await rebaseTokenV2.oracle();
    results.push({
        variableName: 'oracle',
        ...checkValue(contracts.eth.supplyManagerV2, actualOracle),
    });

    return { contractAddress: contracts.eth.metaETH, contractName: 'RebaseTokenV2', results };
}
