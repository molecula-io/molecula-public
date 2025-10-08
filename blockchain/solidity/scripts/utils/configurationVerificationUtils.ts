/*
 * Configuration Verification Utilities
 *
 * This module contains shared utilities for verifying Carbon contract configurations
 * across Ethereum and Tron networks. It provides common interfaces, functions,
 * and constants used by both Ethereum and Tron verification scripts.
 *
 * Features:
 * - Common interfaces for verification results
 * - Shared utility functions for message types and result formatting
 * - Reusable error handling patterns
 * - Cross-chain verification helpers
 */
/* eslint-disable no-await-in-loop, no-restricted-syntax, no-plusplus */

import type { HardhatRuntimeEnvironment } from 'hardhat/types';

/**
 * Represents the result of a single contract variable verification
 */
export interface VerificationResult {
    variableName: string;
    expectedValue: string;
    actualValue: string;
    isMatch: boolean;
}

/**
 * Represents the complete verification results for a contract
 */
export interface ContractVerification {
    contractAddress: string;
    contractName: string;
    results: VerificationResult[];
}

/**
 * Returns human-readable name for message type
 * Maps LayerZero message type numbers to descriptive names
 * @param msgType - Message type number (e.g., 0x01, 0x02, etc.)
 * @returns Readable name for the message type
 */
export function getMessageTypeName(msgType: number): string {
    const messageTypeNames: Record<number, string> = {
        0x01: 'REQUEST_DEPOSIT',
        0x02: 'CONFIRM_DEPOSIT',
        0x03: 'REQUEST_REDEEM',
        0x04: 'CONFIRM_REDEEM',
        0x05: 'DISTRIBUTE_YIELD',
        0x06: 'CONFIRM_DEPOSIT_AND_UPDATE_ORACLE',
        0x07: 'DISTRIBUTE_YIELD_AND_UPDATE_ORACLE',
        0x08: 'UPDATE_ORACLE',
    };

    return messageTypeNames[msgType] || `UNKNOWN_${msgType}`;
}

/**
 * Prints verification results in a formatted way and returns count of incorrect results
 * Shows pass/fail status, expected vs actual values, and summary statistics
 * @param results - Array of ContractVerification objects to display
 */
export function printVerificationResults(results: ContractVerification[]) {
    console.log('\n📊 Verification Results:');
    console.log('='.repeat(80));

    let incorrectCount = 0;

    if (!results) {
        console.log('⚠️ No verification results to display');
        return;
    }

    results.forEach((contract, index) => {
        if (!contract || !contract.contractName || !contract.results) {
            console.log(`⚠️ Invalid contract verification at index ${index}`);
            return;
        }

        console.log(`\n🔧 Contract: ${contract.contractName}`);
        console.log(`📍 Address: ${contract.contractAddress || 'N/A'}`);
        console.log('-'.repeat(60));

        contract.results.forEach((result, resultIndex) => {
            if (!result) {
                console.log(`⚠️ Invalid result at index ${resultIndex}`);
                return;
            }

            const status = result.isMatch ? '✅' : '❌';
            console.log(`${status} ${result.variableName || 'Unknown variable'}:`);
            console.log(`   Expected: ${result.expectedValue || 'N/A'}`);
            console.log(`   Actual:   ${result.actualValue || 'N/A'}`);
            console.log('');

            if (!result.isMatch) {
                incorrectCount++;
            }
        });
    });

    if (incorrectCount === 0) {
        console.log('\n✅ All contract configurations are correct!');
    } else {
        console.log(`\n❌ Some contract configurations are incorrect!`);
        console.log(`📊 Total incorrect results found: ${incorrectCount}`);
    }
}

/**
 * Adds a delay
 * @param ms - Delay in milliseconds
 */
export async function addDelay(ms: number): Promise<void> {
    await new Promise<void>(resolve => {
        setTimeout(resolve, ms);
    });
}

/**
 * Safely converts any value to string for comparison
 * @param value - Value to convert
 * @returns String representation of the value
 */
export function safeToString(value: unknown): string {
    if (value === null || value === undefined) {
        return '';
    }
    return value.toString();
}

/**
 * Compares expected and actual string values (case-insensitive)
 */
export function verifyValue(expectedValue: unknown, actualValue: unknown): boolean {
    return safeToString(actualValue).toLowerCase() === safeToString(expectedValue).toLowerCase();
}

export function toBase58(val: string, hre: HardhatRuntimeEnvironment): string {
    let raw = (val || '').toString().toLowerCase();
    // strip 0x
    if (raw.startsWith('0x')) {
        raw = raw.slice(2);
    }
    // take last 40 hex chars (20 bytes address)
    if (raw.length > 40) {
        raw = raw.slice(-40);
    }
    // prepend 41 Tron prefix
    const hex41 = `41${raw}`;
    return hre.tronweb.address.fromHex(hex41);
}

export function checkValue(expectedValue: unknown, actualValue: unknown) {
    return {
        expectedValue: safeToString(expectedValue),
        actualValue: safeToString(actualValue),
        isMatch: verifyValue(expectedValue, actualValue),
    };
}

export function formatError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

export function failVerificationResult(error: unknown) {
    return {
        variableName: 'Contract Verification',
        expectedValue: 'Successful verification',
        actualValue: `Verification failed: ${formatError(error)}`,
        isMatch: false,
    };
}
