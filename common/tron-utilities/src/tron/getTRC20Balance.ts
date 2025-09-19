import { TronWeb, type Types } from 'tronweb';

import type { TronAddress } from '../types';

import { getTRC20BalanceWithTronWeb } from './getTRC20BalanceWithTronWeb';

type GetTRC20BalanceOptions = {
    /**
     * An address to get the TRC-20 token balance of.
     */
    address: string;

    /**
     * A TRC-20 token address.
     */
    tokenAddress: TronAddress;

    /**
     * Tron web options required for Tron provider.
     */
    tronWebOptions: Types.TronWebOptions;
};

/**
 * Function to get the TRC-20 token balance for an address.
 * @param options - options required to get the TRC-20 token balance for an address.
 * @returns the TRC-20 token balance.
 */
export async function getTRC20Balance({
    address,
    tokenAddress,
    tronWebOptions,
}: GetTRC20BalanceOptions) {
    // Create tron web provider
    const tronWeb = new TronWeb(tronWebOptions);

    // Get the balance with TronWeb
    return getTRC20BalanceWithTronWeb({
        address,
        tokenAddress,
        tronWeb,
    });
}
