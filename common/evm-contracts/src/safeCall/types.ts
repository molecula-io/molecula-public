import type { ContractRunner, Provider } from 'ethers';

import type {
    Executor,
    IMoleculaPoolV2,
    MoleculaPoolTreasury,
    MoleculaPoolTreasuryV2,
    NitrogenTokenVault,
    ShareToken,
} from '@molecula-monorepo/solidity/typechain-types';

import type {
    AavePool,
    AccountantAgent,
    AgentLZ,
    Aragon,
    CommonTokenVault,
    ERC20,
    ERC4626,
    IAgent,
    ICurveStableSwapFactoryNG,
    ICurveStableSwapNG,
    IERC20Basic,
    IERC20Metadata,
    ILayerZeroEndpointV2,
    IOracle,
    MUSDE,
    MUSDLock,
    NativeTokenVault,
    PostfixOverrides,
    RebaseToken,
    ReceiveULN,
    SavingsUSDS,
    SendULN,
    SFrxUSD,
    SparkPool,
    StakedUSDe,
    SupplyManager,
    TokenVault,
    UsdtOFT,
} from '../types';

type AnyFunction = () => void;
type PickFunctions<T> = { [K in keyof T as T[K] extends AnyFunction ? K : never]: T[K] };

export type EvmContractSafeViewCallArgs<
    Contract extends PickFunctions<Contract>,
    Method extends keyof Contract,
> = PostfixOverrides<Parameters<Contract[Method]>, 'view'>;

export type EvmContractSafeCallArgs<
    Contract extends PickFunctions<Contract>,
    Method extends keyof Contract,
> = PostfixOverrides<Parameters<Contract[Method]>, 'nonpayable'>;

export type EvmContractSafeViewCall<Contract extends PickFunctions<Contract>> = <
    Method extends keyof Contract,
>(
    method: Method,
    ...args: PostfixOverrides<Parameters<Contract[Method]>, 'view'>
) => Promise<Awaited<ReturnType<Contract[Method]>>>;

export type EvmContractSafeCall<Contract extends PickFunctions<Contract>, Response> = <
    Method extends keyof Contract,
>(
    method: Method,
    ...args: PostfixOverrides<Parameters<Contract[Method]>, 'payable'>
) => Promise<Response>;

export type EvmContractGasCall<Contract extends PickFunctions<Contract>, Response> = <
    Method extends keyof Contract,
>(
    multiplier: number,
    method: Method,
    ...args: PostfixOverrides<Parameters<Contract[Method]>, 'payable'>
) => Promise<Response>;

export type AllEvmContracts =
    | AavePool
    | AccountantAgent
    | AgentLZ
    | Aragon
    | CommonTokenVault
    | ERC20
    | ERC4626
    | Executor
    | IAgent
    | ICurveStableSwapFactoryNG
    | ICurveStableSwapNG
    | IERC20Basic
    | IERC20Metadata
    | ILayerZeroEndpointV2
    | IMoleculaPoolV2
    | IOracle
    | MoleculaPoolTreasury
    | MoleculaPoolTreasuryV2
    | MUSDE
    | MUSDLock
    | NativeTokenVault
    | NitrogenTokenVault
    | RebaseToken
    | ReceiveULN
    | SavingsUSDS
    | SendULN
    | SFrxUSD
    | ShareToken
    | SparkPool
    | StakedUSDe
    | SupplyManager
    | TokenVault
    | UsdtOFT;

export type ProviderOrRunner = Provider | ContractRunner;
