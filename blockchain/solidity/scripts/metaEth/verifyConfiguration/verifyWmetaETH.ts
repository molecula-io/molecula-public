/*
 * wmetaETH (RewardBearingWrapper) Contract Verification Module
 *
 * This module verifies the configuration of the RewardBearingWrapper (wmetaETH)
 * token: name, symbol, decimals and linked rebase token address.
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

export async function verifyWmetaETHContract(
    hre: HardhatRuntimeEnvironment,
    contracts: ContractsMetaEth,
    config: MetaEthNetworkConfig,
): Promise<ContractVerification> {
    const wmetaETH = await hre.ethers.getContractAt('RewardBearingWrapper', contracts.eth.wmetaETH);

    const results: VerificationResult[] = [];

    const actualName = await wmetaETH.name();
    results.push({
        variableName: 'name',
        ...checkValue(config.WMETA_ETH_TOKEN_NAME, actualName),
    });

    const actualSymbol = await wmetaETH.symbol();
    results.push({
        variableName: 'symbol',
        ...checkValue(config.WMETA_ETH_TOKEN_SYMBOL, actualSymbol),
    });

    const actualDecimals = await wmetaETH.decimals();
    results.push({
        variableName: 'decimals',
        ...checkValue(18, actualDecimals),
    });

    const rebaseTokenAddress = await wmetaETH.rebaseToken();
    results.push({
        variableName: 'rebaseToken',
        ...checkValue(contracts.eth.metaETH, rebaseTokenAddress),
    });

    return {
        contractAddress: contracts.eth.wmetaETH,
        contractName: 'RewardBearingWrapper',
        results,
    };
}
