import { normalizeAddress } from './normalizeAddress';
import type { EVMAddress, Hex } from './types';

/**
 * Returns a 32 bytes address from provided address
 * @param address - provided evm address
 * @returns 32 bytes address
 */
export function addressTo32bytes(address: EVMAddress): Hex {
    if (address.startsWith('0x') && address.length === 66) {
        // Already 32 bytes long
        return address;
    }

    const normalized = normalizeAddress(address);

    return `0x000000000000000000000000${normalized.slice(2)}`;
}
