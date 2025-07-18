import {
    evmAuthorizedAddresses,
    EVMChainIDs,
    evmStaticTokenAddresses,
    staticPoolCurrenciesRetailMainnet,
} from '@molecula-monorepo/blockchain.addresses';

import type { EthereumNetworkConfig } from './types';

/** Ethereum Mainnet config for beta. */
export const ethMainnetBetaConfig: EthereumNetworkConfig = {
    /**
     * LayerZero Ethereum configuration parameters.
     * Endpoint is a primary entrypoint into LayerZero V2 responsible for managing cross-chain communications.
     * Executor is a contract responsible for executing received cross-chain messages automatically
     * https://docs.layerzero.network/v2/deployments/deployed-contracts?chains=ethereum
     */
    LAYER_ZERO_ENDPOINT: '0x1a44076050125825900e736c501f859c50fE728c',
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

    /** MOCK Layer Zero OAPP Tron Mainnet */
    LAYER_ZERO_TRON_MAINNET_OAPP_MOCK:
        '0x51408ca3b420462a5b3f0bf75b6934a521ea3fe4dc2dce5614a995a89f54fcef',

    /** USDT_OFT address. */
    USDT_OFT: '0x811ed79dB9D34E83BDB73DF6c3e07961Cfb0D5c0',

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

    /** AAVE Token for WETH (AToken) token address on Ethereum Mainnet. */
    AWETH_ADDRESS: '0x4d5f47fa6a74757f35c14fd3a6ef8e3c9bc514e8',

    /** Compound Token for WETH (cWETHv3) token address on Ethereum Mainnet. */
    CWETH_V3: '0xA17581A9E3356d9A858b789D68B4d866e593aE94',

    /** Lido LRT Token address on Ethereum Mainnet. */
    STETH_ADDRESS: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84',

    /**  DAI token address on Ethereum Mainnet. */
    DAI_ADDRESS: evmStaticTokenAddresses.DAI[EVMChainIDs.Mainnet],

    /** @deprecated Dai initial supply. */
    INITIAL_DAI_SUPPLY: 5_000_000_000_000_000_000n,

    /** Initial Supply Manager balance. */
    INITIAL_USDT_SUPPLY: 10_000_000n,

    /** Pools Currencies config for retail solutions. */
    TOKENS: Object.values(staticPoolCurrenciesRetailMainnet),

    /** Default whitelist of addresses callable by MoleculaPoolFactory contract. */
    WHITE_LIST: [
        '0xcf5540fffcdc3d510b18bfca6d2b9987b0772559', // ODOS router
        '0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2', // AAVE POOL v3
    ],

    /** Guardian address that can pause MoleculaPoolTreasury contract. */
    GUARDIAN_ADDRESS: '0xD3C1bE6FC208270D43B64083552564955cC1120b', // TODO: change guardian address

    /** (APY_FORMATTER / 10_000) * 100% is the percentage of revenue retained by all mUSD holder. */
    APY_FORMATTER: 8_000,

    /** Owner address. */
    OWNER: '0xD3C1bE6FC208270D43B64083552564955cC1120b',

    /** Pool keeper address. */
    POOL_KEEPER: '0xFA9113efcaD2e08F868b7B00dF67ed404Ec9a00c',

    /** mUSD token decimals. */
    MUSD_TOKEN_DECIMALS: 18,

    /** MUSD token name. */
    MUSD_TOKEN_NAME: 'mUSD release candidate',

    /** MUSD token symbol. */
    MUSD_TOKEN_SYMBOL: 'mUSDrec',

    /** mUSD token minimum deposit. */
    MUSD_TOKEN_MIN_DEPOSIT: 1_000_000n,

    /** mUSD token minimum redeem. */
    MUSD_TOKEN_MIN_REDEEM: 500_000_000_000_000_000n,

    /** Agent Authorized lz configurator address. */
    AGENT_AUTHORIZED_LZ_CONFIGURATOR:
        evmAuthorizedAddresses.AGENT_AUTHORIZED_LZ_CONFIGURATOR[EVMChainIDs.Mainnet].beta,

    /** AAVE v3 Pool Address. */
    AAVE_POOL: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2',

    /** EigenPodManager contract address. */
    EIGEN_POD_MANAGER: '0x91E677b07F7AF907ec9a428aafA9fc14a0d3A338',

    /** DelegationManager contract address. */
    DELEGATION_MANAGER: '0x39053D51B77DC0d36036Fc1fCc8Cb819df8Ef37A',

    /** RewardsCoordinator contract address. */
    REWARDS_COORDINATOR: '0x7750d328b314EfFa365A0402CcfD489B80B0adda',

    /** StrategyFactory contract address. */
    STRATEGY_FACTORY: '0x5e4C39Ad7A3E881585e383dB9827EB4811f6F647',

    /** StETH Strategy contract address. */
    STRATEGY_BASE_STETH: '0x93c4b944D05dfe6df7645A86cd2206016c51564D',

    /** EigenLayer default operator address. */
    EIGENLAYER_OPERATOR: '0x5accc90436492f24e6af278569691e2c942a676d',

    WMUSD_TOKEN_NAME: 'Wrapped mUSD beta',
    WMUSD_TOKEN_SYMBOL: 'wmUSDb',

    LMUSD_TOKEN_NAME: 'Locked mUSD beta',
    LMUSD_TOKEN_SYMBOL: 'lmUSDb',
    LMUSD_PERIODS: [],
    LMUSD_MULTIPLIERS: [],

    /** mrETH token name. */
    MRETH_TOKEN_NAME: 'mrETH release candidate',

    /** mrETH token symbol. */
    MRETH_TOKEN_SYMBOL: 'mrETHrec',

    /** mrETH token decimals. */
    MRETH_TOKEN_DECIMALS: 18,

    /** mrETH token minimum deposit. */
    MRETH_TOKEN_MIN_DEPOSIT: 1_000_000n,

    /** mrETH token minimum redeem. */
    MRETH_TOKEN_MIN_REDEEM: 10n ** 18n,

    // ===================== MetaETH Solution =====================

    /** Owner address. Must specify it before the deployment. */
    META_OWNER: '0x',

    /** Pool keeper address. Must specify it before the deployment. */
    META_POOL_KEEPER: '0x',

    /** Guardian address that can pause MetaPoolTreasury contract. Must specify it before the deployment */
    META_GUARDIAN: '0x',

    /** (META_APY / 10_000) * 100% is the percentage of revenue retained by all molecula token holders. */
    META_APY: 8_000,

    /** MetaETH token name. */
    META_TOKEN_NAME: 'MetaETH release candidate',

    /** MetaETH token symbol. */
    META_TOKEN_SYMBOL: 'METHrc',

    /** MetaETH token decimals. */
    META_TOKEN_DECIMALS: 18,

    /** Minimal deposit in eth */
    META_MIN_DEPOSIT_ETH: 1_000_000n,

    /** Minimal redeem in shares */
    META_MIN_REDEEM_SHARES: 10n ** 18n,
};
