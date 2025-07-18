import type { TronWeb, TransactionInfo } from 'tronweb';

import { Log } from '@molecula-monorepo/common.logs';
import { Async } from '@molecula-monorepo/common.utilities';

const log = new Log('waitForTronTransaction');

/**
 * A utility to wait for the Tron transaction to succeed.
 * @param tronWeb - a TronWeb provider to interact with Tron.
 * @param transactionId - an Id of the transaction to wait for.
 * @param silent - a flag to silent the debug info.
 * @returns a transaction info once it's succeeded.
 * @throws an error in case the transaction hasn't succeeded.
 */
export async function fetchTronTransactionInfo(
    tronWeb: TronWeb,
    transactionId: string,
    silent?: boolean,
): Promise<TransactionInfo> {
    // Get the transaction info

    let info: TransactionInfo | undefined;
    try {
        info = await tronWeb.trx.getTransactionInfo(transactionId);
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
            throw new Error("Transaction has't succeeded");
        }

        // Return the transaction info
        return info;
    }

    // Try again in 3 seconds if no condition is met above
    await Async.timeout(3000);

    // Call again recursively
    return fetchTronTransactionInfo(tronWeb, transactionId);
}
