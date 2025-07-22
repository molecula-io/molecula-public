import type { PoolData } from '@molecula-monorepo/blockchain.addresses';
import type { EVMAddress } from '@molecula-monorepo/common.evm-utilities';

/**
 * Configuration parameters for a Ethereum-based network environment.
 */
export type EthereumNetworkConfig = {
    // LAYER ZERO
    LAYER_ZERO_ENDPOINT: EVMAddress;
    LAYER_ZERO_EXECUTOR: EVMAddress;
    LAYER_ZERO_ETHEREUM_REQUIERED_DVNS: EVMAddress[];

    // LayerZero Executor contract's configuration parameters.
    LAYER_ZERO_PRICE_FEED: EVMAddress;
    LAYER_ZERO_WORKER_FEE_LIB: EVMAddress;
    LAYER_ZERO_SEND_ULN_LIB: EVMAddress;
    LAYER_ZERO_RECEIVE_ULN_LIB: EVMAddress;

    LAYER_ZERO_TRON_EID: number;
    LAYER_ZERO_ETHEREUM_EID: number;
    LAYER_ZERO_ARBITRUM_EID: number;
    LAYER_ZERO_CELO_EID: number;
    LAYER_ZERO_TRON_MAINNET_OAPP_MOCK: string;

    // USDT_OFT address
    USDT_OFT: EVMAddress;

    // Token addresses
    USDT_ADDRESS: EVMAddress;
    USDC_ADDRESS: EVMAddress;
    USDE_ADDRESS: EVMAddress;
    SUSDE_ADDRESS: EVMAddress;
    WETH_ADDRESS: EVMAddress;
    STETH_ADDRESS: EVMAddress;

    // Deploy params
    INITIAL_DAI_SUPPLY: bigint;
    INITIAL_USDT_SUPPLY: bigint;
    DAI_ADDRESS: EVMAddress;

    TOKENS: PoolData[];
    WHITE_LIST: string[];

    GUARDIAN_ADDRESS: EVMAddress;

    APY_FORMATTER: number;

    OWNER: EVMAddress;
    POOL_KEEPER: EVMAddress;

    MUSD_TOKEN_DECIMALS: number;
    MUSD_TOKEN_NAME: string;
    MUSD_TOKEN_SYMBOL: string;
    MUSD_TOKEN_MIN_DEPOSIT: bigint;
    MUSD_TOKEN_MIN_REDEEM: bigint;

    AGENT_AUTHORIZED_LZ_CONFIGURATOR: EVMAddress;

    WMUSD_TOKEN_NAME: string;
    WMUSD_TOKEN_SYMBOL: string;

    LMUSD_TOKEN_NAME: string;
    LMUSD_TOKEN_SYMBOL: string;
    LMUSD_PERIODS: [];
    LMUSD_MULTIPLIERS: [];

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
