import type { mrEthNetworkConfig } from './mrEthConfigTypes';

/** Hoodi config for mrETH protocol. */
export const hoodiMrEthConfig: mrEthNetworkConfig = {
    /** Wrapped ETH (WETH) token address on Ethereum Hoodi. */
    WETH_ADDRESS: '0x5baCb4970Bb6e17f8Db9267eBeD2dc824fFd7F78',

    /** AAVE Mock Token for WETH (AToken) token address on Ethereum Hoodi. */
    AWETH_ADDRESS: '0x62Ef2a0cE8c8FD9E51133E5FcfcC2F779b69A1A8',

    /** Compound Token for WETH (cWETHv3) token address on Ethereum Hoodi. */
    CWETH_V3: '0x0000000000000000000000000000000000000000',

    /** Lido LRT Token address on Ethereum Hoodi. */
    STETH_ADDRESS: '0x2C220A2a91602dd93bEAC7b3A1773cdADE369ba1',

    /** AAVE v3 Mock Pool Address on Ethereum Hoodi. */
    AAVE_POOL: '0x62Ef2a0cE8c8FD9E51133E5FcfcC2F779b69A1A8',

    /** EigenPodManager contract address on Ethereum Hoodi. */
    EIGEN_POD_MANAGER: '0xcd1442415Fc5C29Aa848A49d2e232720BE07976c',

    /** DelegationManager contract address on Ethereum Hoodi. */
    DELEGATION_MANAGER: '0x867837a9722C512e0862d8c2E15b8bE220E8b87d',

    /** RewardsCoordinator contract address on Ethereum Hoodi. */
    REWARDS_COORDINATOR: '0x29e8572678e0c272350aa0b4B8f304E47EBcd5e7',

    /** StrategyFactory contract address on Ethereum Hoodi. */
    STRATEGY_FACTORY: '0xfB7d94501E4d4ACC264833Ef4ede70a11517422B',

    /** StETH Strategy contract address on Ethereum Hoodi. */
    STRATEGY_BASE_STETH: '0xf8a1a66130d614c7360e868576d5e59203475fe0',

    /** EigenLayer default operator address on Ethereum Hoodi. */
    EIGENLAYER_OPERATOR: '0x45eb96D57ee884c2621b28E2D56E974297e53714',

    /** mrETH token name on Ethereum Hoodi. */
    MRETH_TOKEN_NAME: 'mrETH test v0.1',

    /** mrETH token symbol on Ethereum Hoodi. */
    MRETH_TOKEN_SYMBOL: 'mrETHtS',

    /** mrETH token decimals on Ethereum Hoodi. */
    MRETH_TOKEN_DECIMALS: 18,

    /** mrETH token minimum deposit on Ethereum Hoodi. */
    MRETH_TOKEN_MIN_DEPOSIT: 1_000_000n,

    /** mrETH token minimum redeem on Ethereum Hoodi. */
    MRETH_TOKEN_MIN_REDEEM: 10n ** 18n,

    /** Molecula Buffer name on Ethereum Hoodi. */
    MOLECULA_BUFFER_NAME: 'Molecula Buffer Token test v0.1',

    /** Molecula Buffer symbol on Ethereum Hoodi. */
    MOLECULA_BUFFER_SYMBOL: 'mwETHtS',

    /** (APY_FORMATTER / 10_000) * 100% is the percentage of revenue retained by all mUSD holder. */
    APY_FORMATTER: 8_000,
};
