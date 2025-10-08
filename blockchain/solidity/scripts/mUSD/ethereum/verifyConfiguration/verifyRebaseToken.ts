/*
 * RebaseToken Contract Verification Module
 *
 * This module contains functions for verifying RebaseToken contract configuration
 * on Ethereum networks. It handles contract state verification, token parameters,
 * and relationship validation with other Nitrogen contracts.
 */
/* eslint-disable no-await-in-loop, no-restricted-syntax */
import { type HardhatRuntimeEnvironment } from 'hardhat/types';

import type { ContractsNitrogen } from '@molecula-monorepo/blockchain.addresses';

import type { EthereumNetworkConfig } from '../../../../configs/mUSD/ethereum/types';
import type { RebaseToken } from '../../../../typechain-types';
import type {
    VerificationResult,
    ContractVerification,
} from '../../../utils/configurationVerificationUtils';
import { checkValue } from '../../../utils/configurationVerificationUtils';

/**
 * Verifies RebaseToken contract configuration
 * Checks contract state variables, token parameters, and relationships with other contracts
 * @param hre - Hardhat runtime environment
 * @param contractsNitrogen - Deployed Nitrogen contracts object
 * @param config - Configuration object with expected values
 * @returns ContractVerification object with verification results
 */
export async function verifyRebaseTokenContract(
    hre: HardhatRuntimeEnvironment,
    contractsNitrogen: ContractsNitrogen,
    config: EthereumNetworkConfig,
): Promise<ContractVerification> {
    console.log(`\n📋 Verifying RebaseToken contract: ${contractsNitrogen.eth.rebaseToken}`);

    const rebaseToken: RebaseToken = await hre.ethers.getContractAt(
        'RebaseToken',
        contractsNitrogen.eth.rebaseToken,
    );
    const results: VerificationResult[] = [];

    // Verify owner of the contract
    const actualOwner = await rebaseToken.owner();
    results.push({
        variableName: 'owner',
        ...checkValue(config.OWNER, actualOwner),
    });

    // Verify accountant address
    const actualAccountant = await rebaseToken.accountant();
    results.push({
        variableName: 'accountant',
        ...checkValue(contractsNitrogen.eth.accountantAgent, actualAccountant),
    });

    // Verify oracle address (SupplyManager)
    const actualOracle = await rebaseToken.oracle();
    results.push({
        variableName: 'oracle',
        ...checkValue(contractsNitrogen.eth.supplyManager, actualOracle),
    });

    // Verify token name
    const actualName = await rebaseToken.name();
    results.push({
        variableName: 'name',
        ...checkValue(config.MUSD_TOKEN_NAME, actualName),
    });

    // Verify token symbol
    const actualSymbol = await rebaseToken.symbol();
    results.push({
        variableName: 'symbol',
        ...checkValue(config.MUSD_TOKEN_SYMBOL, actualSymbol),
    });

    // Verify token decimals
    const actualDecimals = await rebaseToken.decimals();
    results.push({
        variableName: 'decimals',
        ...checkValue(config.MUSD_TOKEN_DECIMALS, actualDecimals),
    });

    // Verify minimum deposit value
    const actualMinDepositValue = await rebaseToken.minDepositValue();
    results.push({
        variableName: 'minDepositValue',
        ...checkValue(config.MUSD_TOKEN_MIN_DEPOSIT, actualMinDepositValue),
    });

    // Verify minimum redeem value
    const actualMinRedeemValue = await rebaseToken.minRedeemValue();
    results.push({
        variableName: 'minRedeemValue',
        ...checkValue(config.MUSD_TOKEN_MIN_REDEEM, actualMinRedeemValue),
    });

    return {
        contractAddress: contractsNitrogen.eth.rebaseToken,
        contractName: 'RebaseToken',
        results,
    };
}
