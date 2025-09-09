import type { mrEthNetworkConfig } from './mrEthConfigTypes';

/** Sepolia config for mrETH protocol. */
export const sepoliaMrEthConfig: mrEthNetworkConfig = {
    /** Wrapped ETH (WETH) token address on Ethereum Sepolia. */
    WETH_ADDRESS: '0xC558DBdd856501FCd9aaF1E62eae57A9F0629a3c',

    /** AAVE Token for WETH (AToken) token address on Ethereum Sepolia. */
    AWETH_ADDRESS: '0x5b071b590a59395fE4025A0Ccc1FcC931AAc1830',

    /** Compound Token for WETH (cWETHv3) token address on Ethereum Sepolia. */
    CWETH_V3: '0x2943ac1216979aD8dB76D9147F64E61adc126e96',

    /** Lido LRT Token address on Ethereum Sepolia. */
    STETH_ADDRESS: '0x00c71b0fCadE911B2feeE9912DE4Fe19eB04ca56',

    /** AAVE v3 Pool Address. */
    AAVE_POOL: '0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951',

    /** EigenPodManager contract address. */
    EIGEN_POD_MANAGER: '0x56BfEb94879F4543E756d26103976c567256034a',

    /** DelegationManager contract address. */
    DELEGATION_MANAGER: '0xD4A7E1Bd8015057293f0D0A557088c286942e84b',

    /** RewardsCoordinator contract address. */
    REWARDS_COORDINATOR: '0x5ae8152fb88c26ff9ca5C014c94fca3c68029349',

    /** StrategyFactory contract address. */
    STRATEGY_FACTORY: '0x066cF95c1bf0927124DFB8B02B401bc23A79730D',

    /** StETH Strategy contract address. */
    STRATEGY_BASE_STETH: '0x8b29d91e67b013e855EaFe0ad704aC4Ab086a574',

    /** EigenLayer default operator address. */
    EIGENLAYER_OPERATOR: '0xAF1393F3AAe677e7Fe1277C565E4018457240D86',

    /** mrETH token name. */
    MRETH_TOKEN_NAME: 'mrETH test v0.1',

    /** mrETH token symbol. */
    MRETH_TOKEN_SYMBOL: 'mrETHtS',

    /** mrETH token decimals. */
    MRETH_TOKEN_DECIMALS: 18,

    /** mrETH token minimum deposit. */
    MRETH_TOKEN_MIN_DEPOSIT: 1_000_000n,

    /** mrETH token minimum redeem. */
    MRETH_TOKEN_MIN_REDEEM: 10n ** 15n,

    /** Molecula Buffer name. */
    MOLECULA_BUFFER_NAME: 'Molecula Buffer Token test v0.1',

    /** Molecula Buffer symbol. */
    MOLECULA_BUFFER_SYMBOL: 'mwETHtS',

    /** (APY_FORMATTER / 10_000) * 100% is the percentage of revenue retained by all mUSD holder. */
    APY_FORMATTER: 8_000,
};
