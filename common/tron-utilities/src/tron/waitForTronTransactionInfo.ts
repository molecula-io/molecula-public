import type { TronWeb, Types } from 'tronweb';

import { Log } from '@molecula-monorepo/common.logs';
import { Async } from '@molecula-monorepo/common.utilities';

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
}

/**
 * A utility to wait for the Tron transaction to succeed.
 * @param tronWeb - a TronWeb provider to interact with Tron.
 * @param transactionId - an Id of the transaction to wait for.
 * @returns a transaction info once it's succeeded.
 * @throws an error in case the transaction hasn't succeeded.
 */
export async function waitForTronTransactionInfo(
    tronWeb: TronWeb,
    transactionId: string,
    options: Options = {},
): Promise<Types.TransactionInfo> {
    const { silent = false, printEnergyInfo = false } = options;
    // Get the transaction info
    let info: Types.TransactionInfo | undefined;
    try {
        info = await tronWeb.trx.getTransactionInfo(transactionId);
    } catch (error) {
        log.error('Failed to get the transaction info with error:', error);

        // It might throw in case of a network failure, e.g. ERR_NETWORK_CHANGED
        // It's OK, just try again bellow
    }

    // Check if it has the "receipt"
    if (info && 'receipt' in info) {
        if (!silent) {
            log.debug('The awaited transaction info:', info);
        }

        // Check if the transaction has succeeded
        if (info.receipt.result !== 'SUCCESS') {
            throw new Error("Transaction hasn't succeeded");
        }

        // Print transaction energy consumption
        if (printEnergyInfo) {
            console.log(
                'TRX consumed: ',
                tronWeb.fromSun(info.receipt.energy_fee),
                'TRX\nEnergy consumed: ',
                info.receipt.energy_usage_total,
            );
        }

        // Return the transaction info
        return info;
    }

    // Try again in 3 seconds if no
    await Async.timeout(3000);

    // Call again recursively
    return waitForTronTransactionInfo(tronWeb, transactionId, options);
}
