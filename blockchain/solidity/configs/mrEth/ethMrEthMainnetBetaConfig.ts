import type { mrEthNetworkConfig } from './mrEthConfigTypes';

/** Ethereum Mainnet Beta configuration for mrETH protocol */
export const ethMrEthMainnetBetaConfig: mrEthNetworkConfig = {
    /** Owner address on Ethereum Mainnet Beta. */
    OWNER: '0x99EC47D28FB39d1888b025Cf4B33765043c41353',

    /** Yield distributor address on Ethereum Mainnet Beta. */
    YIELD_DISTRIBUTOR: '0x99EC47D28FB39d1888b025Cf4B33765043c41353',

    /** Guardian address on Ethereum Mainnet Beta. */
    GUARDIAN: '0x99EC47D28FB39d1888b025Cf4B33765043c41353',

    /** Wrapped ETH (WETH) token address on Ethereum Mainnet. */
    WETH_ADDRESS: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',

    /** AAVE Token for WETH (AToken) token address on Ethereum Mainnet. */
    AWETH_ADDRESS: '0x4d5f47fa6a74757f35c14fd3a6ef8e3c9bc514e8',

    /** Compound Token for WETH (cWETHv3) token address on Ethereum Mainnet. */
    CWETH_V3: '0xA17581A9E3356d9A858b789D68B4d866e593aE94',

    /** Lido LRT Token address on Ethereum Mainnet. */
    STETH_ADDRESS: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84',

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

    /** mrETH token name. */
    MRETH_TOKEN_NAME: 'Molecula rebase ETH',

    /** mrETH token symbol. */
    MRETH_TOKEN_SYMBOL: 'mrETH',

    /** mrETH token decimals. */
    MRETH_TOKEN_DECIMALS: 18,

    /** mrETH token minimum deposit amount. */
    MRETH_TOKEN_MIN_DEPOSIT: 1_000_000n,

    /** mrETH token minimum redeem amount. */
    MRETH_TOKEN_MIN_REDEEM: 10n ** 15n,

    /** Molecula Buffer token name. */
    MOLECULA_BUFFER_NAME: 'Molecula Buffer Token',

    /** Molecula Buffer token symbol. */
    MOLECULA_BUFFER_SYMBOL: 'mwETH',

    /** (APY_FORMATTER / 10_000) * 100% is the percentage of revenue retained by all mrETH holders. */
    APY_FORMATTER: 8_000,

    /** (BUFFER_PERCENTAGE / 10_000) * 100% is the percentage of TVL that must stay in the Buffer. */
    BUFFER_PERCENTAGE: 500,

    /** (MIN_FEE_PERCENTAGE / 10_000) * 100% is the minimum fee percentage for instant withdrawals. */
    MIN_FEE_PERCENTAGE: 500,

    /** (MAX_FEE_PERCENTAGE / 10_000) * 100% is the maximum fee percentage for instant withdrawals. */
    MAX_FEE_PERCENTAGE: 1000,
};
