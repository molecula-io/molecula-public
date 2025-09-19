import type { TronWeb } from 'tronweb';

import TRC20Abi from '@molecula-monorepo/common.tron-contracts/abis/TRC-20.json';

import type { TronAddress } from '../types';

type GetTRC20BalanceWithTronWebOptions = {
    /**
     * An address to get the TRC-20 token balance of.
     */
    address: string;

    /**
     * A TRC-20 token address.
     */
    tokenAddress: TronAddress;

    /**
     * A TronWeb provider to interact with Tron.
     */
    tronWeb: TronWeb;
};

/**
 * Function to get the TRC-20 token balance for an address.
 * @param options - options required to get the TRC-20 token balance for an address.
 * @returns the TRC-20 token balance.
 */
export async function getTRC20BalanceWithTronWeb({
    address,
    tokenAddress,
    tronWeb,
}: GetTRC20BalanceWithTronWebOptions) {
    // Set the owner address
    // Note: it looks redundant but at the same time required to avoid "owner_address isn't set"
    // See: https://github.com/tronprotocol/tronweb/issues/90#issuecomment-680185336
    tronWeb.setAddress(address);

    // Get the TRC-20 smart-contract instance to work with
    const contract = tronWeb.contract(TRC20Abi, tokenAddress);

    // Call the method to get the balance
    const balance = await contract
        .balanceOf(address)
        .call()
        .catch((error: string) => {
            if (error === 'Smart contract is not exist.') {
                // A custom error message received from Tron Full Node
                // Do not consider it to be an error, just return zero
                return 0n;
            }

            // Throw otherwise
            throw error;
        });

    return BigInt(balance.toString());
}
