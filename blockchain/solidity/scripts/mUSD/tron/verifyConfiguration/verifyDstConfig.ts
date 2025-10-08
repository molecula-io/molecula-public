/*
 * Tron DST Config Verification Utilities
 *
 * This module contains utility functions for verifying Executor dstConfig
 * on Tron by comparing with LayerZero Executor contract.
 */

import { type HardhatRuntimeEnvironment } from 'hardhat/types';
import type { Contract as TronContract } from 'tronweb';

import type { VerificationResult } from '../../../utils/configurationVerificationUtils';
import { checkValue } from '../../../utils/configurationVerificationUtils';

/**
 * Verifies Executor dstConfig on Tron by comparing with LayerZero Executor contract
 * Handles Tron-specific data structures and address conversions
 * @param hre - Hardhat runtime environment
 * @param executor - Tron Executor contract instance
 * @param remoteEid - Remote endpoint ID to verify dstConfig for
 * @param lzExecutorAddress - LayerZero Executor contract address
 * @param results - Array to store verification results
 */
export async function verifyDstConfig(
    hre: HardhatRuntimeEnvironment,
    executor: TronContract,
    remoteEid: number,
    lzExecutorAddress: string,
    results: VerificationResult[],
): Promise<void> {
    if (remoteEid <= 0) {
        throw new Error('Invalid remote EID provided');
    }

    const ourDstConfigRaw = await executor.methods.dstConfig?.(remoteEid).call({
        // @ts-ignore (passing private option)
        _isConstant: true,
    });

    // Normalize LZ executor address (could be 0x..)
    let tronLzExecutor = lzExecutorAddress;
    if (tronLzExecutor && tronLzExecutor.startsWith('0x')) {
        const hex41 = tronLzExecutor.replace(/^0x/, '41');
        tronLzExecutor = hre.tronweb.address.fromHex(hex41);
    }
    const artifact = await hre.artifacts.readArtifact('Executor');
    const lzExecutor = hre.tronweb.contract(artifact.abi, tronLzExecutor) as TronContract;

    const lzDstConfigRaw = await lzExecutor.methods.dstConfig?.(remoteEid).call({
        // @ts-ignore (passing private option)
        _isConstant: true,
    });

    // Verify all dstConfig fields
    results.push({
        variableName: `dstConfig(EID_${remoteEid}).dstEid`,
        ...checkValue(lzDstConfigRaw.dstEid, ourDstConfigRaw.dstEid),
    });
    results.push({
        variableName: `dstConfig(EID_${remoteEid}).lzReceiveBaseGas`,
        ...checkValue(lzDstConfigRaw.lzReceiveBaseGas, ourDstConfigRaw.lzReceiveBaseGas),
    });
    results.push({
        variableName: `dstConfig(EID_${remoteEid}).multiplierBps`,
        ...checkValue(lzDstConfigRaw.multiplierBps, ourDstConfigRaw.multiplierBps),
    });
    results.push({
        variableName: `dstConfig(EID_${remoteEid}).floorMarginUSD`,
        ...checkValue(lzDstConfigRaw.floorMarginUSD, ourDstConfigRaw.floorMarginUSD),
    });
    results.push({
        variableName: `dstConfig(EID_${remoteEid}).nativeCap`,
        ...checkValue(lzDstConfigRaw.nativeCap, ourDstConfigRaw.nativeCap),
    });
    results.push({
        variableName: `dstConfig(EID_${remoteEid}).lzComposeBaseGas`,
        ...checkValue(lzDstConfigRaw.lzComposeBaseGas, ourDstConfigRaw.lzComposeBaseGas),
    });
}
