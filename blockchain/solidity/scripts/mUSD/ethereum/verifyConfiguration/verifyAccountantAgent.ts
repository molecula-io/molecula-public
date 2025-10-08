/*
 * AccountantAgent Contract Verification Module
 *
 * This module contains functions for verifying AccountantAgent contract configuration
 * on Ethereum networks. It handles contract state verification, role assignments,
 * and relationship validation with other Nitrogen contracts.
 */
/* eslint-disable no-await-in-loop, no-restricted-syntax */
import { type HardhatRuntimeEnvironment } from 'hardhat/types';

import type { ContractsNitrogen } from '@molecula-monorepo/blockchain.addresses';

import type { EthereumNetworkConfig } from '../../../../configs/mUSD/ethereum/types';
import type {
    VerificationResult,
    ContractVerification,
} from '../../../utils/configurationVerificationUtils';
import { checkValue } from '../../../utils/configurationVerificationUtils';

/**
 * Verifies AccountantAgent contract configuration
 * Checks contract state variables, relationships with other contracts, and access controls
 * @param hre - Hardhat runtime environment
 * @param contractsNitrogen - Deployed Nitrogen contracts object
 * @param config - Configuration object with expected values
 * @returns ContractVerification object with verification results
 */
export async function verifyAccountantAgentContract(
    hre: HardhatRuntimeEnvironment,
    contractsNitrogen: ContractsNitrogen,
    config: EthereumNetworkConfig,
): Promise<ContractVerification> {
    console.log(
        `\n📋 Verifying AccountantAgent contract: ${contractsNitrogen.eth.accountantAgent}`,
    );

    const accountantAgent = await hre.ethers.getContractAt(
        'AccountantAgent',
        contractsNitrogen.eth.accountantAgent,
    );
    const results: VerificationResult[] = [];

    // Verify owner of the contract
    const actualOwner = await accountantAgent.owner();
    results.push({
        variableName: 'owner',
        ...checkValue(config.OWNER, actualOwner),
    });

    // Verify REBASE_TOKEN address
    const actualRebaseToken = await accountantAgent.REBASE_TOKEN();
    results.push({
        variableName: 'REBASE_TOKEN',
        ...checkValue(contractsNitrogen.eth.rebaseToken, actualRebaseToken),
    });

    // Verify SUPPLY_MANAGER address
    const actualSupplyManager = await accountantAgent.SUPPLY_MANAGER();
    results.push({
        variableName: 'SUPPLY_MANAGER',
        ...checkValue(contractsNitrogen.eth.supplyManager, actualSupplyManager),
    });

    // Verify ERC20_TOKEN address (USDT)
    const actualERC20Token = await accountantAgent.ERC20_TOKEN();
    results.push({
        variableName: 'ERC20_TOKEN',
        ...checkValue(config.USDT_ADDRESS, actualERC20Token),
    });

    // Verify guardian address
    const actualGuardian = await accountantAgent.guardian();
    results.push({
        variableName: 'guardian',
        ...checkValue(config.GUARDIAN_ADDRESS, actualGuardian),
    });

    // Verify isRequestDepositPaused flag (should be false by default)
    const actualIsRequestDepositPaused = await accountantAgent.isRequestDepositPaused();
    results.push({
        variableName: 'isRequestDepositPaused',
        ...checkValue(false, actualIsRequestDepositPaused),
    });

    // Verify isRequestRedeemPaused flag (should be false by default)
    const actualIsRequestRedeemPaused = await accountantAgent.isRequestRedeemPaused();
    results.push({
        variableName: 'isRequestRedeemPaused',
        ...checkValue(false, actualIsRequestRedeemPaused),
    });

    return {
        contractAddress: contractsNitrogen.eth.accountantAgent,
        contractName: 'AccountantAgent',
        results,
    };
}
