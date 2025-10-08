/*
 * Gas Limits Verification Utilities
 *
 * This module contains utility functions for verifying gas limits configuration
 * for LayerZero message types across different contracts.
 */
/* eslint-disable no-await-in-loop, no-restricted-syntax */

import type { AgentLZ } from '../../../../typechain-types';
import { formatGasLimitMsgType, GAS_LIMIT_BASE, GAS_LIMIT_UNIT } from '../../../utils';
import type { VerificationResult } from '../../../utils/configurationVerificationUtils';
import { getMessageTypeName, checkValue } from '../../../utils/configurationVerificationUtils';

/**
 * Verifies gas limits configuration for LayerZero message types
 * Reads baseGas and unitGas for each message type and compares with expected values
 * @param contract - Contract instance (AgentLZ or AccountantLZ)
 * @param gasLimits - Array of gas limit configurations for different message types
 * @param results - Array to store verification results
 */
export async function verifyGasLimits(
    contract: AgentLZ,
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

        const currentBaseGas = await contract.gasLimit(baseGasLimitKey);
        const currentUnitGas = await contract.gasLimit(unitGasLimitKey);

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
