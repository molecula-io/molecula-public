// Export typechain

export * from '../typechain';

export * from '../typechain/common';

export type {
    AgentLZ,
    RebaseToken,
    RebaseTokenV2,
    SupplyManager,
    MUSDE,
    MoleculaPoolTreasury,
    MoleculaPoolTreasuryV2,
    MUSDLock,
    IOracle,
    AccountantAgent,
    ILayerZeroEndpointV2,
    Executor,
    IERC20Basic,
    IERC20Metadata,
    ICurveStableSwapFactoryNG,
    ICurveStableSwapNG,
    UsdtOFT,
} from '@molecula-monorepo/solidity/typechain-types';

const contractsNames = [
    'RebaseToken',
    'RebaseTokenV2',
    'SupplyManager',
    'AgentLZ',
    'ERC20',
    'ERC4626',
    'IERC20Basic',
    'IERC20Metadata',
    'MUSDE',
    'MoleculaPoolTreasury',
    'MoleculaPoolTreasuryV2',
    'MUSDLock',
    'IOracle',
    'AccountantAgent',
    'StakedUSDe',
    'SavingsUSDS',
    'SFrxUSD',
    'AavePool',
    'SparkPool',
    'EndpointLZ',
    'ExecutorLZ',
    'SwapCurve',
    'ICurveStableSwapFactoryNG',
    'ICurveStableSwapNG',
    'UsdtOFT',
    'Aragon',
    'ReceiveULN',
] as const;

export type ContractNameType = (typeof contractsNames)[number];
