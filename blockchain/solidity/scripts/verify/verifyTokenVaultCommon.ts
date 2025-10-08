/*
 * TokenVault Common Verification Module
 *
 * This module contains common verification functions for all TokenVault contract types
 * on Ethereum networks. It handles shared vault state verification, token configuration,
 * and access control validation that applies to all vault implementations.
 */
/* eslint-disable no-await-in-loop, no-restricted-syntax */
import type {
    MetaERC20TokenVault,
    MetaNativeTokenVault,
    WeETHTokenVault,
    RsETHTokenVault,
    EzETHTokenVault,
} from '../../typechain-types';
import type { VerificationResult } from '../utils/configurationVerificationUtils';
import { checkValue, failVerificationResult } from '../utils/configurationVerificationUtils';

// Common expectations for any vault
export type CommonVaultExpectations = {
    owner: string;
    supplyManager: string;
    guardian: string;
    tokenAddress: string;
    minDepositAssets: bigint;
    minRedeemShares: bigint;
    rebaseTokenV2: string;
};

// Common verifier used by all vault types
export async function verifyTokenVault(
    vault:
        | MetaERC20TokenVault
        | MetaNativeTokenVault
        | WeETHTokenVault
        | RsETHTokenVault
        | EzETHTokenVault,
    expectations: CommonVaultExpectations,
): Promise<VerificationResult[]> {
    const results: VerificationResult[] = [];
    try {
        // Verify owner
        const actualOwner = await vault.owner();
        results.push({
            variableName: 'owner',
            ...checkValue(expectations.owner, actualOwner),
        });

        // Verify SUPPLY_MANAGER (immutable)
        const actualSupplyManager = await vault.SUPPLY_MANAGER();
        results.push({
            variableName: 'SUPPLY_MANAGER',
            ...checkValue(expectations.supplyManager, actualSupplyManager),
        });

        // Verify guardian
        const actualGuardian = await vault.guardian();
        results.push({
            variableName: 'guardian',
            ...checkValue(expectations.guardian, actualGuardian),
        });

        // Verify asset()
        const actualAsset = await vault.asset();
        results.push({
            variableName: 'asset',
            ...checkValue(expectations.tokenAddress, actualAsset),
        });

        // Verify minDepositAssets
        const actualMinDepositAssets = await vault.minDepositAssets();
        results.push({
            variableName: 'minDepositAssets',
            ...checkValue(expectations.minDepositAssets, actualMinDepositAssets),
        });

        // Verify minRedeemShares
        const actualMinRedeemShares = await vault.minRedeemShares();
        results.push({
            variableName: 'minRedeemShares',
            ...checkValue(expectations.minRedeemShares, actualMinRedeemShares),
        });

        // Verify share
        const actualShare = await vault.share();
        results.push({
            variableName: 'share',
            ...checkValue(expectations.rebaseTokenV2, actualShare),
        });

        // Verify isRequestDepositPaused
        const actualIsRequestDepositPaused = await vault.isRequestDepositPaused();
        results.push({
            variableName: 'isRequestDepositPaused',
            ...checkValue(false, actualIsRequestDepositPaused),
        });

        // Verify isRequestRedeemPaused
        const actualIsRequestRedeemPaused = await vault.isRequestRedeemPaused();
        results.push({
            variableName: 'isRequestRedeemPaused',
            ...checkValue(false, actualIsRequestRedeemPaused),
        });
    } catch (error) {
        results.push(failVerificationResult(error));
    }

    return results;
}
