import {
    evmAuthorizedAddresses,
    EVMChainIDs,
    evmStaticTokenAddresses,
    staticPoolCurrenciesRetailMainnet,
    staticPoolCurrenciesMetaETHMainnet,
    evmStaticOFTAddresses,
    evmLayerZeroEndpointV2Addresses,
} from '@molecula-monorepo/blockchain.addresses';

import type { EthereumNetworkConfig } from './types';

/** Ethereum Mainnet config for prod. */
export const ethMainnetProdConfig: EthereumNetworkConfig = {
    /**
     * LayerZero Ethereum configuration parameters.
     * Endpoint is a primary entrypoint into LayerZero V2 responsible for managing cross-chain communications.
     * Executor is a contract responsible for executing received cross-chain messages automatically
     * https://docs.layerzero.network/v2/deployments/deployed-contracts?chains=ethereum
     */
    LAYER_ZERO_ENDPOINT: evmLayerZeroEndpointV2Addresses[EVMChainIDs.Mainnet],
    LAYER_ZERO_EXECUTOR: '0x173272739Bd7Aa6e4e214714048a9fE699453059',
    LAYER_ZERO_ETHEREUM_REQUIERED_DVNS: [
        '0x3b0531eB02Ab4aD72e7a531180beeF9493a00dD2', // USDT0 DVN address
        '0x589dEDbD617e0CBcB916A9223F4d1300c294236b', // LayerZero Labs DVN address
    ],

    // LayerZero Executor contract's configuration parameters.
    LAYER_ZERO_PRICE_FEED: '0xC03f31fD86a9077785b7bCf6598Ce3598Fa91113',
    LAYER_ZERO_WORKER_FEE_LIB: '0x4e9C57FD2Bd0f47C43F2D62642C1b05894fb9ed0',
    LAYER_ZERO_SEND_ULN_LIB: '0xbB2Ea70C9E858123480642Cf96acbcCE1372dCe1',
    LAYER_ZERO_RECEIVE_ULN_LIB: '0xc02Ab410f0734EFa3F14628780e6e695156024C2',

    /** LayerZero Tron EID. */
    LAYER_ZERO_TRON_EID: 30420,

    /** Layer Zero EID Ethereum Mainnet. */
    LAYER_ZERO_ETHEREUM_EID: 30101,

    /** ARBITRUM EID. */
    LAYER_ZERO_ARBITRUM_EID: 30110,

    /** CELO EID. */
    LAYER_ZERO_CELO_EID: 30125,

    /** SOLANA EID. */
    LAYER_ZERO_SOLANA_EID: 30168,

    /** MOCK Layer Zero OAPP Tron Mainnet */
    LAYER_ZERO_TRON_MAINNET_OAPP_MOCK:
        '0x51408ca3b420462a5b3f0bf75b6934a521ea3fe4dc2dce5614a995a89f54fcef',

    /** USDT_OFT address. */
    USDT_OFT: evmStaticOFTAddresses.USDT[EVMChainIDs.Mainnet],

    /** USDT token address on Ethereum Mainnet. */
    USDT_ADDRESS: evmStaticTokenAddresses.USDT[EVMChainIDs.Mainnet],

    /** USDC token address on Ethereum Mainnet. */
    USDC_ADDRESS: evmStaticTokenAddresses.USDC[EVMChainIDs.Mainnet],

    /** USDe token address on Ethereum Mainnet. */
    USDE_ADDRESS: evmStaticTokenAddresses.USDe[EVMChainIDs.Mainnet],

    /** Staked USDe (sUSDe) token address on Ethereum Mainnet. */
    SUSDE_ADDRESS: evmStaticTokenAddresses.sUSDe[EVMChainIDs.Mainnet],

    /** Wrapped ETH (WETH) token address on Ethereum Mainnet. */
    WETH_ADDRESS: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',

    /** Lido LRT Token address on Ethereum Mainnet. */
    STETH_ADDRESS: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84',

    /**  DAI token address on Ethereum Mainnet. */
    DAI_ADDRESS: evmStaticTokenAddresses.DAI[EVMChainIDs.Mainnet],

    /** Initial Supply Manager balance. */
    INITIAL_USDT_SUPPLY: 100_000_000n,

    /** Pools Currencies config for retail solutions. */
    MOLECULA_POOL_TOKENS: Object.values(staticPoolCurrenciesRetailMainnet),
    /** Pools Currencies config for MetaETH solution. */
    META_POOL_TOKENS: Object.values(staticPoolCurrenciesMetaETHMainnet),

    /** Default whitelist of addresses callable by MoleculaPoolFactory contract. */
    WHITE_LIST: [
        // ODOS router
        {
            target: '0xcf5540fffcdc3d510b18bfca6d2b9987b0772559',
            // swapCompact
            selector: '0x83bd37f9',
        },
        {
            target: '0xcf5540fffcdc3d510b18bfca6d2b9987b0772559',
            // swapMultiCompact
            selector: '0x84a7f3dd',
        },
        // AAVE POOL v3
        {
            target: '0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2',
            // supply
            selector: '0x617ba037',
        },
        {
            target: '0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2',
            // withdraw
            selector: '0x69328dec',
        },
    ],

    /** Guardian address that can pause MoleculaPoolTreasury contract. */
    GUARDIAN_ADDRESS: '0x287C4e87840E02032D4518eF6d7E69E20B5184a4', // TODO: change guardian address

    /** (APY_FORMATTER / 10_000) * 100% is the percentage of revenue retained by all mUSD holder. */
    APY_FORMATTER: 8_000,

    /** Owner address. */
    OWNER: '0x287C4e87840E02032D4518eF6d7E69E20B5184a4',

    /** Pool keeper address. */
    POOL_KEEPER: '0xD6a625Bc1AeD44e4F0F8E1Fee6F2578f4105Cd06',

    /** mUSD token decimals. */
    MUSD_TOKEN_DECIMALS: 18,

    /** MUSD token name. */
    MUSD_TOKEN_NAME: 'Molecula USD',

    /** MUSD token symbol. */
    MUSD_TOKEN_SYMBOL: 'mUSD',

    /** mUSD token minimum deposit. */
    MUSD_TOKEN_MIN_DEPOSIT: 1_000_000n,

    /** mUSD token minimum redeem. */
    MUSD_TOKEN_MIN_REDEEM: 500_000_000_000_000_000n,

    /** Agent Authorized lz configurator address. */
    AGENT_AUTHORIZED_LZ_CONFIGURATOR:
        evmAuthorizedAddresses.AGENT_AUTHORIZED_LZ_CONFIGURATOR[EVMChainIDs.Mainnet].prod,

    WMUSD_TOKEN_NAME: 'Wrapped Molecula USD',
    WMUSD_TOKEN_SYMBOL: 'wmUSD',

    LMUSD_TOKEN_NAME: 'Locked Molecula USD',
    LMUSD_TOKEN_SYMBOL: 'lmUSD',
    LMUSD_PERIODS: [],
    LMUSD_MULTIPLIERS: [],
};
