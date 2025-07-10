import { ethers } from 'ethers';

import type { EVMAddress } from '@molecula-monorepo/blockchain.addresses';

/**
 * Returns a normalized and checksumed address for provided address
 * @param address - provided evm address
 */
export function normalizeAddress(address: EVMAddress): EVMAddress {
    if (address.length > 42) {
        // Remove extra 000... (eq: 32 bytes have been provided)
        const split = address.split('x')[1]?.slice(-40);

        return ethers.getAddress(`0x${split}`) as EVMAddress;
    }

    return ethers.getAddress(address) as EVMAddress;
}
