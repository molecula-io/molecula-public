/**
 * Gas limit for contract deploy (Gas limit is increased due to the large smart-contract).
 */
export const DEPLOY_GAS_LIMIT = 5_500_000;

/**
 * Default approver signature and expiry for operator delegation.
 */
export const APPROVER_SIGNATURE_AND_EXPIRY = {
    signature: '0x',
    expiry: 0,
};

/**
 * Default approver salt for operator delegation.
 */
export const APPROVER_SALT = '0x0000000000000000000000000000000000000000000000000000000000000000';

/**
 * Standard address used to represent the native token (ETH) in the system.
 */
export const NATIVE_TOKEN = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

/**
 * Fantom initial share and assert supply for eth-based solutions.
 * It's about 300 USD.
 */
export const ETH_VIRTUAL_OFFSET = 10n ** 17n;
