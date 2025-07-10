import { tronAuthorizedAddresses, TronChainIDs } from '@molecula-monorepo/blockchain.addresses';

import type { TronNetworkConfig } from './types';

export const shastaConfig: TronNetworkConfig = {
    RPC_URL: 'https://api.shasta.trongrid.io/',

    /**
     * LayerZero Tron configuration parameters.
     * Endpoint is a primary entrypoint into LayerZero V2 responsible for managing cross-chain communications.
     * Executor is a contract responsible for executing received cross-chain messages automatically
     * https://docs.layerzero.network/v2/deployments/deployed-contracts?chains=tron-testnet
     */
    LAYER_ZERO_TRON_ENDPOINT: 'TCT5FvMTuUCspdY689LbKbUThCwBVUw4tM',
    LAYER_ZERO_TRON_EXECUTOR: '0xd9F0144AC7cED407a12dE2649b560b0a68a59A3D',
    LAYER_ZERO_TRON_REQUIERED_DVNS: [
        '0xC6b1A264D9bB30A8d19575B0Bb3BA525A3a6FC93', // LayerZero Labs DVN address
    ],
    // LayerZero Executor contract's configuration parameters.
    LAYER_ZERO_EXECUTOR: 'TVqZEgk73zHEn89SPFUfRv8zELsieUMD2y',
    LAYER_ZERO_PRICE_FEED: 'THyXmFzHfs81NmfF1iAQ1oNAiNyKkYby1t',
    LAYER_ZERO_WORKER_FEE_LIB: 'TGisyuSS66tPyMMQBcsUhGaRhcJK8L3Ti8',
    LAYER_ZERO_SEND_ULN_LIB: 'TRvKXqDiPd4y1RCjLyadYeEoPrcyg9CERs',
    LAYER_ZERO_RECEIVE_ULN_LIB: 'TN2KMvPCcmCq9vVzGUcrzrbwXLy5f3qZeZ',

    /** SEPOLIA EID. */
    LAYER_ZERO_ETHEREUM_EID: 40161,

    /** SHASTA EID. */
    LAYER_ZERO_TRON_EID: 40420,

    /** ARBITRUM SEPOLIA EID. */
    LAYER_ZERO_ARBITRUM_EID: 40231,

    /** CELO TESTNET EID. */
    LAYER_ZERO_CELO_EID: 40125,

    // System contracts
    USDT_ADDRESS: 'TG3XXyExBkPp9nzdajDZsozEu4BkaSJozs',
    USDT_OFT: 'TKSnyHmNMFhU2vWp2zBDZE48b1gd54GBcs',

    // Authorized wallets
    OWNER: 'TNSphg4KJNTvhNzZZsvAXDpUESC11HT4T3',
    ORACLE_AUTHORIZED_UPDATER:
        tronAuthorizedAddresses.ORACLE_AUTHORIZED_UPDATER[TronChainIDs.Shasta],
    ACCOUNTANT_AUTHORIZED_LZ_CONFIGURATOR:
        tronAuthorizedAddresses.ACCOUNTANT_AUTHORIZED_LZ_CONFIGURATOR[TronChainIDs.Shasta],

    // Token info
    MUSD_TOKEN_NAME: 'mUSD retail test v0.14',
    MUSD_TOKEN_SYMBOL: 'mUSDretS',
    MUSD_TOKEN_DECIMALS: 18,
    MUSD_TOKEN_MIN_DEPOSIT: 1000000n,
    MUSD_TOKEN_MIN_REDEEM: 1_000_000_000_000_000_000n,
    MUSD_TOKEN_INITIAL_SUPPLY: 10_000_000_000_000_000_000n,
};
