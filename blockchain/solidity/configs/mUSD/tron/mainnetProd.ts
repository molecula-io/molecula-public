import {
    tronAuthorizedAddresses,
    TronChainIDs,
    tronStaticOFTAddresses,
    tronStaticTokenAddresses,
} from '@molecula-monorepo/blockchain.addresses';

import type { TronNetworkConfig } from './types';

export const tronMainnetProdConfig: TronNetworkConfig = {
    RPC_URL: 'https://api.trongrid.io/',

    /**
     * LayerZero Tron configuration parameters.
     * Endpoint is a primary entrypoint into LayerZero V2 responsible for managing cross-chain communications.
     * Executor is a contract responsible for executing received cross-chain messages automatically
     * https://docs.layerzero.network/v2/deployments/deployed-contracts?chains=tron
     */
    LAYER_ZERO_TRON_ENDPOINT: 'TAy9xwjYjBBN6kutzrZJaAZJHCAejjK1V9',
    LAYER_ZERO_TRON_EXECUTOR: '0x67DE40af19C0C0a6D0278d96911889fAF4EBc1Bc',
    LAYER_ZERO_TRON_REQUIERED_DVNS: [
        '0x8bC1D368036EE5E726D230beB685294BE191A24e', // LayerZero Labs DVN address
        '0xE13b0667fcE48d12773EAd95D87dc9d1c58544DF', // USDT0 DVN address
    ],

    // LayerZero Executor contract's configuration parameters.
    LAYER_ZERO_EXECUTOR: 'TKSQrCn9r7jdNxWuQGRw8RJT8x4LFNfr7B',
    LAYER_ZERO_PRICE_FEED: 'TLw8tyzdGvBQAJ8udJaqW3gUeB6FanjBZZ',
    LAYER_ZERO_WORKER_FEE_LIB: 'TJzufosriKzXsSECBiusTcVndAm9dDvfTr',
    LAYER_ZERO_SEND_ULN_LIB: 'TWhf9vzMEGmWjn538ymX76sgGN3LxG7mQJ',
    LAYER_ZERO_RECEIVE_ULN_LIB: 'TJpoNxF3CreFRpTdLhyXuJzEo4vMAns7Wz',

    LAYER_ZERO_ETHEREUM_EID: 30101,
    LAYER_ZERO_TRON_EID: 30420,
    LAYER_ZERO_ARBITRUM_EID: 30110,
    LAYER_ZERO_CELO_EID: 30125,
    LAYER_ZERO_SOLANA_EID: 30168,

    // System contracts
    USDT_ADDRESS: tronStaticTokenAddresses.USDT[TronChainIDs.Mainnet],
    USDT_OFT: tronStaticOFTAddresses.USDT[TronChainIDs.Mainnet],

    // Authorized wallets
    OWNER: 'TRe77oDAPYpxfdAZtswUfeqqjJ5ABcMs6S',
    ORACLE_AUTHORIZED_UPDATER:
        tronAuthorizedAddresses.ORACLE_AUTHORIZED_UPDATER[TronChainIDs.Mainnet].prod,
    ACCOUNTANT_AUTHORIZED_LZ_CONFIGURATOR:
        tronAuthorizedAddresses.ACCOUNTANT_AUTHORIZED_LZ_CONFIGURATOR[TronChainIDs.Mainnet].prod,

    // Token info
    MUSD_TOKEN_NAME: 'Molecula USD',
    MUSD_TOKEN_SYMBOL: 'mUSD',
    MUSD_TOKEN_DECIMALS: 18,
    MUSD_TOKEN_MIN_DEPOSIT: 1_000_000n,
    MUSD_TOKEN_MIN_REDEEM: 500_000_000_000_000_000n,
    MUSD_TOKEN_INITIAL_SUPPLY: 10_000_000_000_000_000_000n,

    // Wrapped token info
    WMUSD_NAME: 'Wrapped Molecula USD',
    WMUSD_SYMBOL: 'wmUSD',
};
