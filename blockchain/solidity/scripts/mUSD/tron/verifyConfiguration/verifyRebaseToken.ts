/*
 * RebaseToken Contract Verification Module for Tron
 *
 * This module contains functions for verifying RebaseToken contract configuration
 * on Tron networks. It checks token parameters, owner, accountant, and oracle addresses.
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
 * Verifies RebaseToken contract configuration
 */
export async function verifyRebaseTokenContract(
    hre: HardhatRuntimeEnvironment,
    contractAddress: string,
    config: TronNetworkConfig,
    contracts: ContractsCarbon,
): Promise<ContractVerification> {
    console.log(`\n📋 Verifying RebaseToken contract: ${contractAddress}`);

    const artifact = await hre.artifacts.readArtifact('RebaseToken');
    const rebaseToken = hre.tronweb.contract(artifact.abi, contractAddress) as TronContract;

    const results: VerificationResult[] = [];

    // Verify owner
    const owner = hre.tronweb.address.fromHex(
        await rebaseToken.methods.owner?.().call({
            // @ts-ignore (passing private option)
            _isConstant: true,
        }),
    );
    await addDelay(SMALL_DELAY); // Add delay to avoid rate limiting
    results.push({
        variableName: 'owner',
        ...checkValue(config.OWNER, owner),
    });

    // Verify accountant address
    const accountant = hre.tronweb.address.fromHex(
        await rebaseToken.methods.accountant?.().call({
            // @ts-ignore (passing private option)
            _isConstant: true,
        }),
    );
    await addDelay(SMALL_DELAY); // Add delay to avoid rate limiting
    results.push({
        variableName: 'accountant',
        ...checkValue(contracts.tron.accountantLZ, accountant),
    });

    // Verify oracle address
    const oracle = hre.tronweb.address.fromHex(
        await rebaseToken.methods.oracle?.().call({
            // @ts-ignore (passing private option)
            _isConstant: true,
        }),
    );
    await addDelay(SMALL_DELAY); // Add delay to avoid rate limiting

    results.push({
        variableName: 'oracle',
        ...checkValue(contracts.tron.oracle, oracle),
    });

    // Verify token name
    const name = await rebaseToken.methods.name?.().call({
        // @ts-ignore (passing private option)
        _isConstant: true,
    });
    results.push({
        variableName: 'name',
        ...checkValue(config.MUSD_TOKEN_NAME, name),
    });

    // Verify token symbol
    const symbol = await rebaseToken.methods.symbol?.().call({
        // @ts-ignore (passing private option)
        _isConstant: true,
    });
    results.push({
        variableName: 'symbol',
        ...checkValue(config.MUSD_TOKEN_SYMBOL, symbol),
    });

    // Verify token decimals
    const decimals = await rebaseToken.methods.decimals?.().call({
        // @ts-ignore (passing private option)
        _isConstant: true,
    });
    results.push({
        variableName: 'decimals',
        ...checkValue(config.MUSD_TOKEN_DECIMALS, decimals),
    });

    // Verify min deposit
    const minDeposit = await rebaseToken.methods.minDepositValue?.().call({
        // @ts-ignore (passing private option)
        _isConstant: true,
    });
    results.push({
        variableName: 'minDeposit',
        ...checkValue(config.MUSD_TOKEN_MIN_DEPOSIT, minDeposit),
    });

    // Verify min redeem
    const minRedeem = await rebaseToken.methods.minRedeemValue?.().call({
        // @ts-ignore (passing private option)
        _isConstant: true,
    });
    results.push({
        variableName: 'minRedeem',
        ...checkValue(config.MUSD_TOKEN_MIN_REDEEM, minRedeem),
    });

    return {
        contractAddress,
        contractName: 'RebaseToken',
        results,
    };
}
