import type { ethers, Provider, TransactionReceipt } from 'ethers';

import { Log } from '@molecula-monorepo/common.logs';
import { Async } from '@molecula-monorepo/common.utilities';

import { evmQueue } from '../helpers';

import {
    EvmTransactionRuntimeError,
    EvmTransactionRuntimeErrors,
} from './waitForEthereumTransactionError';

const log = new Log('waitForEthereumTransaction');

interface Options {
    /**
     * Use it to silent debug info.
     *
     * @defaultValue - false
     */
    silent?: boolean;
    /**
     * The external signal that tells to stop listening for transaction.
     */
    signal?: AbortSignal | undefined;
}

/**
 * A utility to wait for the Tron transaction to succeed.
 * @param rpcProvider - a rpc provider to interact with Ethereum.
 * @param transactionId - an Id of the transaction to wait for.
 * @param options - additional configuration.
 * @returns a transaction info once it's succeeded.
 * @throws an error in case the transaction hasn't succeeded.
 */
export async function waitForEthereumTransaction(
    rpcProvider: Provider,
    transactionId: string,
    options: Options = {},
): Promise<ethers.TransactionReceipt> {
    const { silent = false, signal } = options;

    if (!transactionId.startsWith('0x')) {
        throw new Error(`Invalid transaction ID: ${transactionId}`);
    }

    // Get the transaction info
    let info: TransactionReceipt | null | undefined;
    try {
        info = await evmQueue.add(() => rpcProvider.getTransactionReceipt(transactionId));
    } catch (error) {
        log.debug('Failed to get the transaction info with error:', error);

        // It might throw in case of a network failure, e.g. ERR_NETWORK_CHANGED
        // It's OK, just try again below
    }

    // Check if it has the "receipt"
    if (info && 'status' in info) {
        if (!silent) {
            log.debug('The awaited transaction info:', info);
        }

        // Check if the transaction has succeeded
        if (info.status !== 1 /** Success */) {
            throw new EvmTransactionRuntimeError(EvmTransactionRuntimeErrors.Unsuccessful);
        }

        // Return the transaction info
        return info;
    }

    // Check if the signal is aborted
    if (signal?.aborted) {
        throw new EvmTransactionRuntimeError(EvmTransactionRuntimeErrors.Aborted);
    }

    // Try again in 3 seconds if no
    await Async.timeout(3000);

    // Call again recursively
    return waitForEthereumTransaction(rpcProvider, transactionId, options);
}
