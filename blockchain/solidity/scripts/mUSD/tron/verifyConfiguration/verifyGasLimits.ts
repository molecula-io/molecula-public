/*
 * Tron Gas Limits Verification Utilities
 *
 * This module contains utility functions for verifying gas limits configuration
 * for Tron contracts and LayerZero message types.
 */
/* eslint-disable no-await-in-loop, no-restricted-syntax */

import type { Contract as TronContract } from 'tronweb';

import { SMALL_DELAY } from '../../../../configs';
import { formatGasLimitMsgType, GAS_LIMIT_BASE, GAS_LIMIT_UNIT } from '../../../utils';
import type { VerificationResult } from '../../../utils/configurationVerificationUtils';
import {
    getMessageTypeName,
    addDelay,
    checkValue,
} from '../../../utils/configurationVerificationUtils';

/**
 * Verifies gas limits configuration for Tron contracts (AccountantLZ)
 * Reads baseGas and unitGas for each message type and compares with expected values
 * @param tronContract - Tron contract instance (AccountantLZ)
 * @param gasLimits - Array of gas limit configurations for different message types
 * @param results - Array to store verification results
 */
export async function verifyGasLimits(
    tronContract: TronContract,
    gasLimits: Array<{ msgType: number; baseGas: number; unitGas: number }>,
    results: VerificationResult[],
): Promise<void> {
    for (const { msgType, baseGas, unitGas } of gasLimits) {
        // Skip if both are 0 (not configured)
        if (baseGas === 0 && unitGas === 0) {
            continue;
        }

        const baseGasLimitKey = formatGasLimitMsgType(msgType, GAS_LIMIT_BASE);
        const unitGasLimitKey = formatGasLimitMsgType(msgType, GAS_LIMIT_UNIT);

        const currentBaseGas = await tronContract.methods.gasLimit?.(baseGasLimitKey).call({
            // @ts-ignore (passing private option)
            _isConstant: true,
        });
        await addDelay(SMALL_DELAY); // Add delay to avoid rate limiting

        const currentUnitGas = await tronContract.methods.gasLimit?.(unitGasLimitKey).call({
            // @ts-ignore (passing private option)
            _isConstant: true,
        });
        await addDelay(SMALL_DELAY); // Add delay to avoid rate limiting

        const msgTypeHex = `0x${msgType.toString(16).padStart(2, '0')}`;
        const msgTypeName = getMessageTypeName(msgType);

        results.push({
            variableName: `gasLimit(${msgTypeName} - ${msgTypeHex}).baseGas`,
            ...checkValue(baseGas, currentBaseGas),
        });

        results.push({
            variableName: `gasLimit(${msgTypeName} - ${msgTypeHex}).unitGas`,
            ...checkValue(unitGas, currentUnitGas),
        });
    }
}
