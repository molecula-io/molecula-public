import type { EVMAddress } from '@molecula-monorepo/common.evm-utilities';

/**
 * Configuration parameters for metaEth.
 */
export type MetaEthNetworkConfig = {
    wETH: EVMAddress;
    stETH: EVMAddress;
    weETH: EVMAddress;
    rsETH: EVMAddress;
    ezETH: EVMAddress;

    OWNER: EVMAddress;
    POOL_KEEPER: EVMAddress;
    GUARDIAN: EVMAddress;
    YIELD_DISTRIBUTOR: EVMAddress;
    APY: number;

    META_ETH_TOKEN_NAME: string;
    META_ETH_TOKEN_SYMBOL: string;
    META_ETH_TOKEN_DECIMALS: number;

    WMETA_ETH_TOKEN_NAME: string;
    WMETA_ETH_TOKEN_SYMBOL: string;

    MIN_DEPOSIT_ETH: bigint;
    MIN_DEPOSIT_weETH: bigint;
    MIN_DEPOSIT_ezETH: bigint;
    MIN_DEPOSIT_rsETH: bigint;
    MIN_REDEEM_SHARES: bigint;
};
