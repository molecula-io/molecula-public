/*
 * Executor Contract Verification Module
 *
 * This module contains functions for verifying Executor contract configuration
 * on Ethereum networks. It checks priceFeed, workerFeeLib, defaultMultiplierBps,
 * and dstConfig parameters, comparing dstConfig with LayerZero Executor contract.
 */
/* eslint-disable no-restricted-syntax */
import { type HardhatRuntimeEnvironment } from 'hardhat/types';

import type { EthereumNetworkConfig } from '../../../../configs/mUSD/ethereum/types';
import type { Executor } from '../../../../typechain-types';

import type {
    VerificationResult,
    ContractVerification,
} from '../../../utils/configurationVerificationUtils';
import { checkValue } from '../../../utils/configurationVerificationUtils';

/**
 * Retrieves Executor contract parameters (priceFeed, workerFeeLib, dstConfig)
 * Helper function to get actual values from deployed Executor contract
 * @param executor - Executor contract instance
 * @param config - Configuration object containing expected values
 * @returns Object containing priceFeed, workerFeeLib, and dstConfig values
 */
export async function getExecutorParams(
    executor: Executor,
    config: EthereumNetworkConfig,
): Promise<{
    priceFeed: string;
    workerFeeLib: string;
    dstConfig: unknown;
}> {
    const [priceFeed, workerFeeLib, dstConfig] = await Promise.all([
        executor.priceFeed?.(),
        executor.workerFeeLib?.(),
        executor.dstConfig?.(config.LAYER_ZERO_TRON_EID),
    ]);

    return {
        priceFeed: String(priceFeed),
        workerFeeLib: String(workerFeeLib),
        dstConfig,
    };
}

/**
 * Verifies Executor's dstConfig by comparing with LayerZero Executor contract
 * Fetches dstConfig from both our Executor and LayerZero Executor, then compares all fields
 * @param executor - Our deployed Executor contract instance
 * @param remoteEid - Remote endpoint ID to verify dstConfig for
 * @param lzExecutorAddress - LayerZero Executor contract address
 * @param hre - Hardhat runtime environment
 * @param results - Array to store verification results
 */
export async function verifyDstConfigWithLZ(
    executor: Executor,
    remoteEid: number,
    lzExecutorAddress: string,
    hre: HardhatRuntimeEnvironment,
    results: VerificationResult[],
): Promise<void> {
    if (remoteEid <= 0) {
        throw new Error('Invalid remote EID provided');
    }

    // Get dstConfig from our Executor
    const ourDstConfig = await executor.dstConfig(remoteEid);

    // Get dstConfig from LayerZero Executor
    const lzExecutor = await hre.ethers.getContractAt('Executor', lzExecutorAddress);
    const lzDstConfig = await lzExecutor.dstConfig(remoteEid);

    // Verify lzReceiveBaseGas
    results.push({
        variableName: `dstConfig(EID_${remoteEid}).lzReceiveBaseGas`,
        ...checkValue(lzDstConfig.lzReceiveBaseGas, ourDstConfig.lzReceiveBaseGas),
    });

    // Verify multiplierBps
    results.push({
        variableName: `dstConfig(EID_${remoteEid}).multiplierBps`,
        ...checkValue(lzDstConfig.multiplierBps, ourDstConfig.multiplierBps),
    });

    // Verify floorMarginUSD
    results.push({
        variableName: `dstConfig(EID_${remoteEid}).floorMarginUSD`,
        ...checkValue(lzDstConfig.floorMarginUSD, ourDstConfig.floorMarginUSD),
    });

    // Verify nativeCap
    results.push({
        variableName: `dstConfig(EID_${remoteEid}).nativeCap`,
        ...checkValue(lzDstConfig.nativeCap, ourDstConfig.nativeCap),
    });

    // Verify lzComposeBaseGas
    results.push({
        variableName: `dstConfig(EID_${remoteEid}).lzComposeBaseGas`,
        ...checkValue(lzDstConfig.lzComposeBaseGas, ourDstConfig.lzComposeBaseGas),
    });
}

/**
 * Verifies Executor contract configuration
 * Checks priceFeed, workerFeeLib, defaultMultiplierBps, and dstConfig parameters
 * Compares dstConfig with LayerZero Executor contract for accuracy
 * @param hre - Hardhat runtime environment
 * @param contractAddress - Executor contract address
 * @param config - Configuration object with expected values
 * @returns ContractVerification object with verification results
 */
export async function verifyExecutorContract(
    hre: HardhatRuntimeEnvironment,
    contractAddress: string,
    config: EthereumNetworkConfig,
): Promise<ContractVerification> {
    console.log(`\n📋 Verifying Executor contract: ${contractAddress}`);

    const executor: Executor = await hre.ethers.getContractAt('Executor', contractAddress);
    const results: VerificationResult[] = [];

    // Get actual Executor parameters for comparison
    const executorParams = await getExecutorParams(executor, config);

    // Verify LayerZero endpoint
    const actualEndpoint = await executor.ENDPOINT();
    results.push({
        variableName: 'ENDPOINT',
        ...checkValue(config.LAYER_ZERO_ENDPOINT, actualEndpoint),
    });

    // Verify LayerZero local endpoint ID
    const actualLocalEidV2 = await executor.LOCAL_EID_V2();
    results.push({
        variableName: 'LOCAL_EID_V2',
        ...checkValue(config.LAYER_ZERO_ETHEREUM_EID, actualLocalEidV2),
    });

    // Verify LayerZero receive ULN library
    const actualReceiveUln302 = await executor.RECEIVE_ULN302();
    results.push({
        variableName: 'RECEIVE_ULN302',
        ...checkValue(config.LAYER_ZERO_RECEIVE_ULN_LIB, actualReceiveUln302),
    });

    // Verify priceFeed with actual value (if available)
    if (executorParams) {
        const actualPriceFeed = await executor.priceFeed();
        results.push({
            variableName: 'priceFeed',
            ...checkValue(executorParams.priceFeed, actualPriceFeed),
        });

        const actualWorkerFeeLib = await executor.workerFeeLib();
        results.push({
            variableName: 'workerFeeLib',
            ...checkValue(executorParams.workerFeeLib, actualWorkerFeeLib),
        });
    }

    // Verify default multiplier BPS
    const actualMultiplierBps = await executor.defaultMultiplierBps();
    results.push({
        variableName: 'defaultMultiplierBps',
        ...checkValue(12000, actualMultiplierBps),
    });

    // Verify allowlist size
    const actualAllowlistSize = await executor.allowlistSize();
    results.push({
        variableName: 'allowlistSize',
        ...checkValue(0, actualAllowlistSize),
    });

    // Verify dstConfig with actual values from LayerZero contract
    await verifyDstConfigWithLZ(
        executor,
        config.LAYER_ZERO_TRON_EID,
        config.LAYER_ZERO_EXECUTOR,
        hre,
        results,
    );

    // Verify roles based on Worker constructor
    // DEFAULT_ADMIN_ROLE is public in AccessControl
    const DEFAULT_ADMIN_ROLE = await executor.DEFAULT_ADMIN_ROLE();
    const ownerIsDefaultAdmin = await executor.hasRole(DEFAULT_ADMIN_ROLE, config.OWNER);
    results.push({
        variableName: 'hasRole(DEFAULT_ADMIN_ROLE, OWNER)',
        ...checkValue(true, ownerIsDefaultAdmin),
    });

    // ADMIN_ROLE = keccak256("ADMIN_ROLE") (internal const), compute off-chain
    const ADMIN_ROLE = hre.ethers.keccak256(hre.ethers.toUtf8Bytes('ADMIN_ROLE'));
    const ownerIsAdmin = await executor.hasRole(ADMIN_ROLE, config.OWNER);
    results.push({
        variableName: 'hasRole(ADMIN_ROLE, OWNER)',
        ...checkValue(true, ownerIsAdmin),
    });

    // MESSAGE_LIB_ROLE = keccak256("MESSAGE_LIB_ROLE") must be granted to send library
    const MESSAGE_LIB_ROLE = hre.ethers.keccak256(hre.ethers.toUtf8Bytes('MESSAGE_LIB_ROLE'));
    const sendLibHasRole = await executor.hasRole(MESSAGE_LIB_ROLE, config.LAYER_ZERO_SEND_ULN_LIB);
    results.push({
        variableName: 'hasRole(MESSAGE_LIB_ROLE, SEND_ULN_LIB)',
        ...checkValue(true, sendLibHasRole),
    });

    return {
        contractAddress,
        contractName: 'Executor',
        results,
    };
}
