import type { EVMAddress } from '@molecula-monorepo/common.evm-utilities';

/**
 * Configuration parameters for a mrETH protocol in Ethereum-based networks.
 */
export type mrEthNetworkConfig = {
    // Token addresses
    WETH_ADDRESS: EVMAddress;
    AWETH_ADDRESS: EVMAddress;
    CWETH_V3: EVMAddress;
    STETH_ADDRESS: EVMAddress;

    AAVE_POOL: EVMAddress;

    EIGEN_POD_MANAGER: EVMAddress;
    DELEGATION_MANAGER: EVMAddress;
    REWARDS_COORDINATOR: EVMAddress;
    STRATEGY_FACTORY: EVMAddress;
    STRATEGY_BASE_STETH: EVMAddress;
    EIGENLAYER_OPERATOR: EVMAddress;

    MRETH_TOKEN_NAME: string;
    MRETH_TOKEN_SYMBOL: string;
    MRETH_TOKEN_DECIMALS: number;
    MRETH_TOKEN_MIN_DEPOSIT: bigint;
    MRETH_TOKEN_MIN_REDEEM: bigint;

    APY_FORMATTER: number;
};
