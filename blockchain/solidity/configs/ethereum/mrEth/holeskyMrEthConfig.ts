import type { mrEthNetworkConfig } from './mrEthConfigTypes';

/** Holesky config for mrETH protocol. */
export const holeskyMrEthConfig: mrEthNetworkConfig = {
    /** Wrapped ETH (WETH) token address on EthereumHolesky. */
    WETH_ADDRESS: '0x94373a4919B3240D86eA41593D5eBa789FEF3848',

    /** AAVE Mock Token for WETH (AToken) token address on Ethereum Holesky. */
    AWETH_ADDRESS: '0xCFaBbCC539de33f27928C73bc541Dde46e657a45',

    /** Compound Token for WETH (cWETHv3) token address on Ethereum Holesky. */
    CWETH_V3: '0x0000000000000000000000000000000000000000',

    /** Lido LRT Token address on Ethereum Holesky. */
    STETH_ADDRESS: '0x3F1c547b21f65e10480dE3ad8E19fAAC46C95034',

    /** AAVE v3 Mock Pool Address on Ethereum Holesky. */
    AAVE_POOL: '0xCFaBbCC539de33f27928C73bc541Dde46e657a45',

    /** EigenPodManager contract address on Ethereum Holesky. */
    EIGEN_POD_MANAGER: '0x30770d7E3e71112d7A6b7259542D1f680a70e315',

    /** DelegationManager contract address on Ethereum Holesky. */
    DELEGATION_MANAGER: '0xA44151489861Fe9e3055d95adC98FbD462B948e7',

    /** RewardsCoordinator contract address on Ethereum Holesky. */
    REWARDS_COORDINATOR: '0xAcc1fb458a1317E886dB376Fc8141540537E68fE',

    /** StrategyFactory contract address on Ethereum Holesky. */
    STRATEGY_FACTORY: '0x9c01252B580efD11a05C00Aa42Dd3ac1Ec52DF6d',

    /** StETH Strategy contract address on Ethereum Holesky. */
    STRATEGY_BASE_STETH: '0x7D704507b76571a51d9caE8AdDAbBFd0ba0e63d3',

    /** EigenLayer default operator address on Ethereum Holesky. */
    EIGENLAYER_OPERATOR: '0xEBd296858D594c3E0AEe0394CEE67F503FC0CD73',

    /** mrETH token name on Ethereum Holesky. */
    MRETH_TOKEN_NAME: 'mrETH test v0.1',

    /** mrETH token symbol on Ethereum Holesky. */
    MRETH_TOKEN_SYMBOL: 'mrETHtS',

    /** mrETH token decimals on Ethereum Holesky. */
    MRETH_TOKEN_DECIMALS: 18,

    /** mrETH token minimum deposit on Ethereum Holesky. */
    MRETH_TOKEN_MIN_DEPOSIT: 1_000_000n,

    /** mrETH token minimum redeem on Ethereum Holesky. */
    MRETH_TOKEN_MIN_REDEEM: 10n ** 18n,

    /** (APY_FORMATTER / 10_000) * 100% is the percentage of revenue retained by all mUSD holder. */
    APY_FORMATTER: 8_000,
};
