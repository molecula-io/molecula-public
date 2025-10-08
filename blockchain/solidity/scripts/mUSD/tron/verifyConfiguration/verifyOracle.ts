/*
 * Oracle Contract Verification Module for Tron
 *
 * This module contains functions for verifying Oracle contract configuration
 * on Tron networks. It ensures AccountantLZ is registered as an authorized updater.
 */

import { type HardhatRuntimeEnvironment } from 'hardhat/types';
import type { Contract as TronContract } from 'tronweb';

import type { ContractsCarbon } from '@molecula-monorepo/blockchain.addresses';

import { SMALL_DELAY } from '../../../../configs';
import type { TronNetworkConfig } from '../../../../configs/mUSD/tron/types';
import type {
    VerificationResult,
    ContractVerification,
} from '../../../utils/configurationVerificationUtils';
import { addDelay, checkValue } from '../../../utils/configurationVerificationUtils';

/**
 * Verifies Oracle contract configuration
 */
export async function verifyOracleContract(
    hre: HardhatRuntimeEnvironment,
    contractAddress: string,
    config: TronNetworkConfig,
    contracts: ContractsCarbon,
): Promise<ContractVerification> {
    console.log(`\n📋 Verifying Oracle contract: ${contractAddress}`);

    const artifact = await hre.artifacts.readArtifact('TronOracle');
    const oracle = hre.tronweb.contract(artifact.abi, contractAddress) as TronContract;

    const results: VerificationResult[] = [];

    // Verify authorized updater (AccountantLZ should be authorized)
    const isAccountantAuthorized = await oracle.methods
        .isAuthorizedUpdater?.(contracts.tron.accountantLZ)
        .call({
            // @ts-ignore (passing private option)
            _isConstant: true,
        });
    await addDelay(SMALL_DELAY); // Add delay to avoid rate limiting
    results.push({
        variableName: `isAuthorizedUpdater(${contracts.tron.accountantLZ})`,
        ...checkValue(true, isAccountantAuthorized),
    });

    // Verify owner
    const owner = hre.tronweb.address.fromHex(
        await oracle.methods.owner?.().call({
            // @ts-ignore (passing private option)
            _isConstant: true,
        }),
    );
    await addDelay(SMALL_DELAY); // Add delay to avoid rate limiting

    results.push({
        variableName: 'owner',
        ...checkValue(config.OWNER, owner),
    });

    return {
        contractAddress,
        contractName: 'Oracle',
        results,
    };
}
