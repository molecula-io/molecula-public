import type { EVMAddress } from '@molecula-monorepo/common.evm-utilities';

/**
 * Configuration parameters for metaEth.
 */
export type MetaEthNetworkConfig = {
    WETH_ADDRESS: EVMAddress;
    STETH_ADDRESS: EVMAddress;

    META_OWNER: EVMAddress;
    META_POOL_KEEPER: EVMAddress;
    META_GUARDIAN: EVMAddress;
    META_APY: number;
    META_TOKEN_NAME: string;
    META_TOKEN_SYMBOL: string;
    META_TOKEN_DECIMALS: number;
    META_MIN_DEPOSIT_ETH: bigint;
    META_MIN_REDEEM_SHARES: bigint;
};
