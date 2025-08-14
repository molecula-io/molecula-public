import type { ContractRunner, Provider } from 'ethers';

import type {
    Executor,
    IMoleculaPoolV2,
    MoleculaPoolTreasury,
    MoleculaPoolTreasuryV2,
} from '@molecula-monorepo/solidity/typechain-types';

import type {
    AgentLZ,
    MUSDLock,
    RebaseToken,
    SupplyManager,
    IOracle,
    AccountantAgent,
    ILayerZeroEndpointV2,
    MUSDE,
    ERC20,
    ERC4626,
    StakedUSDe,
    SavingsUSDS,
    SFrxUSD,
    AavePool,
    PostfixOverrides,
    IERC20Basic,
    ICurveStableSwapFactoryNG,
    ICurveStableSwapNG,
    IERC20Metadata,
    SparkPool,
    UsdtOFT,
    Aragon,
    ReceiveULN,
    SendULN,
    TokenVault,
    NativeTokenVault,
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
    ...args: PostfixOverrides<Parameters<Contract[Method]>, 'nonpayable'>
) => Promise<Response>;

export type EvmContractGasCall<Contract extends PickFunctions<Contract>, Response> = <
    Method extends keyof Contract,
>(
    multiplier: number,
    method: Method,
    ...args: PostfixOverrides<Parameters<Contract[Method]>, 'nonpayable'>
) => Promise<Response>;

export type AllEvmContracts =
    | IMoleculaPoolV2
    | MoleculaPoolTreasury
    | MoleculaPoolTreasuryV2
    | AgentLZ
    | AccountantAgent
    | ERC20
    | ERC4626
    | IERC20Basic
    | IERC20Metadata
    | RebaseToken
    | MUSDLock
    | SupplyManager
    | IOracle
    | StakedUSDe
    | SavingsUSDS
    | SFrxUSD
    | ILayerZeroEndpointV2
    | ReceiveULN
    | SendULN
    | Executor
    | MUSDE
    | AavePool
    | SparkPool
    | ICurveStableSwapFactoryNG
    | ICurveStableSwapNG
    | UsdtOFT
    | Aragon
    | TokenVault
    | NativeTokenVault;

export type ProviderOrRunner = Provider | ContractRunner;
