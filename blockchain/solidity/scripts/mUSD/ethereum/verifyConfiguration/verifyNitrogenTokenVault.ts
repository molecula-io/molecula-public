/*
 * NitrogenTokenVault Contract Verification Module
 *
 * This module contains functions for verifying NitrogenTokenVault contract configuration
 * on Ethereum networks. It handles contract state verification, vault parameters,
 * and relationship validation with other Nitrogen contracts.
 */
/* eslint-disable no-await-in-loop, no-restricted-syntax */
import { type HardhatRuntimeEnvironment } from 'hardhat/types';

import type { ContractsNitrogen } from '@molecula-monorepo/blockchain.addresses';

import type { EthereumNetworkConfig } from '../../../../configs/mUSD/ethereum/types';
import type { NitrogenTokenVault } from '../../../../typechain-types';
import type {
    VerificationResult,
    ContractVerification,
} from '../../../utils/configurationVerificationUtils';
import { checkValue, failVerificationResult } from '../../../utils/configurationVerificationUtils';

/**
 * Verifies NitrogenTokenVault contract configuration
 * Checks contract state variables, vault parameters, and relationships with other contracts
 * @param hre - Hardhat runtime environment
 * @param vaultAddress - Address of the NitrogenTokenVault contract
 * @param tokenName - Name of the token this vault handles
 * @param contractsNitrogen - Deployed Nitrogen contracts object
 * @param config - Configuration object with expected values
 * @returns ContractVerification object with verification results
 */
export async function verifyNitrogenTokenVaultContract(
    hre: HardhatRuntimeEnvironment,
    vaultAddress: string,
    tokenName: string,
    contractsNitrogen: ContractsNitrogen,
    config: EthereumNetworkConfig,
): Promise<ContractVerification> {
    console.log(`\n📋 Verifying NitrogenTokenVault contract for ${tokenName}: ${vaultAddress}`);

    const nitrogenTokenVault: NitrogenTokenVault = await hre.ethers.getContractAt(
        'NitrogenTokenVault',
        vaultAddress,
    );
    const results: VerificationResult[] = [];

    try {
        // Verify owner of the contract
        const actualOwner = await nitrogenTokenVault.owner();
        results.push({
            variableName: 'owner',
            ...checkValue(config.OWNER, actualOwner),
        });

        // Verify REBASE_TOKEN_OWNER address
        const actualTokenOwner = await nitrogenTokenVault.REBASE_TOKEN_OWNER();
        results.push({
            variableName: 'REBASE_TOKEN_OWNER',
            ...checkValue(contractsNitrogen.eth.rebaseTokenOwner, actualTokenOwner),
        });

        // Verify SUPPLY_MANAGER address
        const actualSupplyManager = await nitrogenTokenVault.SUPPLY_MANAGER();
        results.push({
            variableName: 'SUPPLY_MANAGER',
            ...checkValue(contractsNitrogen.eth.supplyManager, actualSupplyManager),
        });

        // Verify guardian address
        const actualGuardian = await nitrogenTokenVault.guardian();
        results.push({
            variableName: 'guardian',
            ...checkValue(config.GUARDIAN_ADDRESS, actualGuardian),
        });

        // Verify asset address (the token this vault handles)
        const actualAsset = String(await nitrogenTokenVault.asset());
        const isAssetNotZero = actualAsset !== hre.ethers.ZeroAddress;
        results.push({
            variableName: 'asset',
            expectedValue: 'Non-zero ERC20 token address',
            actualValue: actualAsset,
            isMatch: isAssetNotZero,
        });

        // Verify minimum deposit assets
        const actualMinDepositAssets = await nitrogenTokenVault.minDepositAssets();
        results.push({
            variableName: 'minDepositAssets',
            ...checkValue(config.MUSD_TOKEN_MIN_DEPOSIT, actualMinDepositAssets),
        });

        // Verify minimum redeem shares
        const actualMinRedeemShares = await nitrogenTokenVault.minRedeemShares();
        results.push({
            variableName: 'minRedeemShares',
            ...checkValue(config.MUSD_TOKEN_MIN_REDEEM, actualMinRedeemShares),
        });

        // Verify getERC20Token() returns the correct asset address
        const actualErc20Token = await nitrogenTokenVault.getERC20Token();
        const expectedErc20Token = await nitrogenTokenVault.asset();
        results.push({
            variableName: 'getERC20Token()',
            ...checkValue(expectedErc20Token, actualErc20Token),
        });

        // Verify that the vault is properly initialized (has an asset set)
        const assetForInit = await nitrogenTokenVault.asset();
        const isInitialized = assetForInit !== hre.ethers.ZeroAddress;
        results.push({
            variableName: 'isInitialized',
            expectedValue: 'true',
            actualValue: String(isInitialized),
            isMatch: isInitialized,
        });
    } catch (error) {
        results.push(failVerificationResult(error));
    }

    return {
        contractAddress: vaultAddress,
        contractName: `NitrogenTokenVault(${tokenName})`,
        results,
    };
}
