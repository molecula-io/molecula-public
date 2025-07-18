import type { TronWeb, GetTransactionResponse, TransactionInfo } from 'tronweb';

import { Log } from '@molecula-monorepo/common.logs';
import { Async } from '@molecula-monorepo/common.utilities';

import {
    TronTransactionRuntimeError,
    TronTransactionRuntimeErrors,
} from './waitForTronTransactionErrors';

const log = new Log('waitForTronTransaction');

interface Options {
    /**
     * Use it to silent debug info.
     *
     * @defaultValue - false
     */
    silent?: boolean;
    /**
     * Whether to print energy info or not.
     *
     * @defaultValue - false
     */
    printEnergyInfo?: boolean;
    /**
     * The external signal that tells to stop listening for transaction.
     */
    signal?: AbortSignal | undefined;
}

/**
 * A utility to wait for the Tron transaction to succeed.
 * @param tronWeb - a TronWeb provider to interact with Tron.
 * @param transactionId - an Id of the transaction to wait for.
 * @param options - additional configuration.
 * @returns a transaction info once it's succeeded.
 * @throws an error in case the transaction hasn't succeeded.
 */
export async function waitForTronTransaction(
    tronWeb: TronWeb,
    transactionId: string,
    options: Options = {},
): Promise<TransactionInfo | GetTransactionResponse> {
    const { silent = false, printEnergyInfo = false, signal } = options;
    // Note: the transaction is supposed to succeed if one of two conditions is met:
    // 1. Either the transaction info's "receipt" object has a "SUCCESS" "result"
    // 2. Or the transaction data's "ret" array has an item with a "SUCCESS" "contractRet"

    // Get the transaction info and tne transaction data

    let info: TransactionInfo | undefined;
    let data: GetTransactionResponse | undefined;
    try {
        [info, data] = await Promise.all([
            tronWeb.trx.getTransactionInfo(transactionId),
            tronWeb.trx.getTransaction(transactionId),
        ]);
    } catch (error) {
        log.debug('Failed to get the transaction details with error:', error);

        // It might throw in case of a network failure, e.g. ERR_NETWORK_CHANGED
        // It's OK, just try again below
    }

    // Check if the transaction info has the "receipt" with the transaction result
    if (info && 'receipt' in info && 'result' in info.receipt) {
        if (!silent) {
            log.debug('The awaited transaction info:', info);
        }

        // Check if the transaction has succeeded
        if (info.receipt.result !== 'SUCCESS') {
            if (info.receipt.result === 'OUT_OF_ENERGY') {
                throw new TronTransactionRuntimeError(TronTransactionRuntimeErrors.OutOfEnergy);
            }
            throw new TronTransactionRuntimeError(TronTransactionRuntimeErrors.Unsuccessful);
        }

        // Print transaction energy consumption
        if (printEnergyInfo) {
            console.log(
                'TRX consumed: ',
                // @ts-ignore (probably wrong type annotation)
                tronWeb.fromSun(info.receipt.energy_fee),
                'TRX\nEnergy consumed: ',
                info.receipt.energy_usage_total,
            );
        }

        // Return the transaction info
        return info;
    }

    // Check if the transaction data has the "ret" property with the results of the transaction
    if (data && 'ret' in data && data.ret && data.ret.length > 0 && 'contractRet' in data.ret[0]) {
        if (!silent) {
            log.debug('The awaited transaction data:', data);
        }

        // Check if the transaction has succeeded
        if (data.ret[0].contractRet !== 'SUCCESS') {
            if (data.ret[0].contractRet === 'OUT_OF_ENERGY') {
                throw new TronTransactionRuntimeError(TronTransactionRuntimeErrors.OutOfEnergy);
            }
            throw new TronTransactionRuntimeError(TronTransactionRuntimeErrors.Unsuccessful);
        }

        // Return the transaction data
        return data;
    }

    if (signal?.aborted) {
        throw new TronTransactionRuntimeError(TronTransactionRuntimeErrors.Aborted);
    }

    // Try again in 3 seconds if no condition is met above
    await Async.timeout(3000);

    // Call again recursively
    return waitForTronTransaction(tronWeb, transactionId, options);
}
