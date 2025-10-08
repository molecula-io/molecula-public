/*
 * MetaPoolTreasury Contract Verification Module
 *
 * This module contains functions for verifying MetaPoolTreasury contract configuration
 * on Ethereum networks. It handles treasury state verification, access control validation,
 * and parameter consistency checks for the MetaPoolTreasury contract.
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

export async function verifyMetaPoolTreasuryContract(
    hre: HardhatRuntimeEnvironment,
    contracts: ContractsMetaEth,
    config: MetaEthNetworkConfig,
): Promise<ContractVerification> {
    const metaPoolTreasury = await hre.ethers.getContractAt(
        'MetaPoolTreasury',
        contracts.eth.metaPoolTreasury,
    );
    const results: VerificationResult[] = [];

    const actualOwner = await metaPoolTreasury.owner();
    results.push({
        variableName: 'owner',
        ...checkValue(config.OWNER, actualOwner),
    });

    const actualPoolKeeper = await metaPoolTreasury.poolKeeper();
    results.push({
        variableName: 'poolKeeper',
        ...checkValue(config.POOL_KEEPER, actualPoolKeeper),
    });

    const actualSupplyManager = await metaPoolTreasury.SUPPLY_MANAGER();
    results.push({
        variableName: 'SUPPLY_MANAGER',
        ...checkValue(contracts.eth.supplyManagerV2, actualSupplyManager),
    });

    const actualGuardian = await metaPoolTreasury.guardian();
    results.push({
        variableName: 'guardian',
        ...checkValue(config.GUARDIAN, actualGuardian),
    });

    const actualPriceChecker = await metaPoolTreasury.priceChecker();
    results.push({
        variableName: 'priceChecker',
        ...checkValue(contracts.eth.priceChecker, actualPriceChecker),
    });

    return {
        contractAddress: contracts.eth.metaPoolTreasury,
        contractName: 'MetaPoolTreasury',
        results,
    };
}
