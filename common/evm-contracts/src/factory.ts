/* eslint-disable max-lines */
/* eslint-disable camelcase */
import {
    AgentLZ__factory,
    RebaseToken__factory,
    RebaseTokenV2__factory,
    SupplyManager__factory,
    MUSDE__factory,
    MUSDLock__factory,
    IOracle__factory,
    AccountantAgent__factory,
    ILayerZeroEndpointV2__factory,
    IERC20Basic__factory,
    IERC20Metadata__factory,
    IMoleculaPoolV2__factory,
    MoleculaPoolTreasury__factory,
    ICurveStableSwapFactoryNG__factory,
    ICurveStableSwapNG__factory,
    UsdtOFT__factory,
    Executor__factory,
    MoleculaPoolTreasuryV2__factory,
    SupplyManagerV2__factory,
} from '@molecula-monorepo/solidity/typechain-types';

import {
    ERC20__factory,
    AavePool__factory,
    SparkPool__factory,
    ERC4626__factory,
    StakedUSDe__factory,
    SavingsUSDS__factory,
    SFrxUSD__factory,
    Curve__factory,
    Aragon__factory,
    ReceiveULN__factory,
} from '../typechain';

import { ERC20Safe } from './contracts';

import { type AllEvmContracts, EvmContractSafe, type ProviderOrRunner } from './safeCall';

import type {
    AgentLZ,
    RebaseToken,
    RebaseTokenV2,
    SupplyManager,
    ERC4626,
    MUSDE,
    MUSDLock,
    IOracle,
    AccountantAgent,
    IMoleculaPoolV2,
    MoleculaPoolTreasury,
    MoleculaPoolTreasuryV2,
    StakedUSDe,
    SavingsUSDS,
    SFrxUSD,
    AavePool,
    SparkPool,
    ILayerZeroEndpointV2,
    Executor,
    IERC20Basic,
    IERC20Metadata,
    ContractNameType,
    Curve,
    ICurveStableSwapFactoryNG,
    ICurveStableSwapNG,
    UsdtOFT,
    Aragon,
    ReceiveULN,
    SupplyManagerV2,
} from './types';

export const EvmContractSafeFactory = {
    RebaseToken: (address: string, rpcProvider: ProviderOrRunner) => {
        return new EvmContractSafe<RebaseToken>(
            {
                factory: RebaseToken__factory,
                address,
            },
            rpcProvider,
        );
    },

    RebaseTokenV2: (address: string, rpcProvider: ProviderOrRunner) => {
        return new EvmContractSafe<RebaseTokenV2>(
            {
                factory: RebaseTokenV2__factory,
                address,
            },
            rpcProvider,
        );
    },

    SupplyManager: (address: string, rpcProvider: ProviderOrRunner) => {
        return new EvmContractSafe<SupplyManager>(
            {
                factory: SupplyManager__factory,
                address,
            },
            rpcProvider,
        );
    },

    SupplyManagerV2: (address: string, rpcProvider: ProviderOrRunner) => {
        return new EvmContractSafe<SupplyManagerV2>(
            {
                factory: SupplyManagerV2__factory,
                address,
            },
            rpcProvider,
        );
    },

    AgentLZ: (address: string, rpcProvider: ProviderOrRunner) => {
        return new EvmContractSafe<AgentLZ>(
            {
                factory: AgentLZ__factory,
                address,
            },
            rpcProvider,
        );
    },

    ERC20: (address: string, rpcProvider: ProviderOrRunner) => {
        return new ERC20Safe(
            {
                factory: ERC20__factory,
                address,
            },
            rpcProvider,
        );
    },

    ERC4626: (address: string, rpcProvider: ProviderOrRunner) => {
        return new EvmContractSafe<ERC4626>(
            {
                factory: ERC4626__factory,
                address,
            },
            rpcProvider,
        );
    },

    IERC20Basic: (address: string, rpcProvider: ProviderOrRunner) => {
        return new EvmContractSafe<IERC20Basic>(
            {
                factory: IERC20Basic__factory,
                address,
            },
            rpcProvider,
        );
    },
    IERC20Metadata: (address: string, rpcProvider: ProviderOrRunner) => {
        return new EvmContractSafe<IERC20Metadata>(
            {
                factory: IERC20Metadata__factory,
                address,
            },
            rpcProvider,
        );
    },
    MUSDE: (address: string, rpcProvider: ProviderOrRunner) => {
        return new EvmContractSafe<MUSDE>(
            {
                factory: MUSDE__factory,
                address,
            },
            rpcProvider,
        );
    },

    IMoleculaPoolV2: (address: string, rpcProvider: ProviderOrRunner) => {
        return new EvmContractSafe<IMoleculaPoolV2>(
            {
                factory: IMoleculaPoolV2__factory,
                address,
            },
            rpcProvider,
        );
    },

    MoleculaPoolTreasury: (address: string, rpcProvider: ProviderOrRunner) => {
        return new EvmContractSafe<MoleculaPoolTreasury>(
            {
                factory: MoleculaPoolTreasury__factory,
                address,
            },
            rpcProvider,
        );
    },

    MoleculaPoolTreasuryV2: (address: string, rpcProvider: ProviderOrRunner) => {
        return new EvmContractSafe<MoleculaPoolTreasuryV2>(
            {
                factory: MoleculaPoolTreasuryV2__factory,
                address,
            },
            rpcProvider,
        );
    },

    MUSDLock: (address: string, rpcProvider: ProviderOrRunner) => {
        return new EvmContractSafe<MUSDLock>(
            {
                factory: MUSDLock__factory,
                address,
            },
            rpcProvider,
        );
    },
    IOracle: (address: string, rpcProvider: ProviderOrRunner) => {
        return new EvmContractSafe<IOracle>(
            {
                factory: IOracle__factory,
                address,
            },
            rpcProvider,
        );
    },
    AccountantAgent: (address: string, rpcProvider: ProviderOrRunner) => {
        return new EvmContractSafe<AccountantAgent>(
            {
                factory: AccountantAgent__factory,
                address,
            },
            rpcProvider,
        );
    },
    StakedUSDe: (address: string, rpcProvider: ProviderOrRunner) => {
        return new EvmContractSafe<StakedUSDe>(
            {
                factory: StakedUSDe__factory,
                address,
            },
            rpcProvider,
        );
    },
    SavingsUSDS: (address: string, rpcProvider: ProviderOrRunner) => {
        return new EvmContractSafe<SavingsUSDS>(
            {
                factory: SavingsUSDS__factory,
                address,
            },
            rpcProvider,
        );
    },
    SFrxUSD: (address: string, rpcProvider: ProviderOrRunner) => {
        return new EvmContractSafe<SFrxUSD>(
            {
                factory: SFrxUSD__factory,
                address,
            },
            rpcProvider,
        );
    },
    AavePool: (address: string, rpcProvider: ProviderOrRunner) => {
        return new EvmContractSafe<AavePool>(
            {
                factory: AavePool__factory,
                address,
            },
            rpcProvider,
        );
    },
    SparkPool: (address: string, rpcProvider: ProviderOrRunner) => {
        return new EvmContractSafe<SparkPool>(
            {
                factory: SparkPool__factory,
                address,
            },
            rpcProvider,
        );
    },
    EndpointLZ: (address: string, rpcProvider: ProviderOrRunner) => {
        return new EvmContractSafe<ILayerZeroEndpointV2>(
            {
                factory: ILayerZeroEndpointV2__factory,
                address,
            },
            rpcProvider,
        );
    },
    ExecutorLZ: (address: string, rpcProvider: ProviderOrRunner) => {
        return new EvmContractSafe<Executor>(
            {
                factory: Executor__factory,
                address,
            },
            rpcProvider,
        );
    },
    ReceiveULN: (address: string, rpcProvider: ProviderOrRunner) => {
        return new EvmContractSafe<ReceiveULN>(
            {
                factory: ReceiveULN__factory,
                address,
            },
            rpcProvider,
        );
    },
    SwapCurve: (address: string, rpcProvider: ProviderOrRunner) => {
        return new EvmContractSafe<Curve>(
            {
                factory: Curve__factory,
                address,
            },
            rpcProvider,
        );
    },

    ICurveStableSwapFactoryNG: (address: string, rpcProvider: ProviderOrRunner) => {
        return new EvmContractSafe<ICurveStableSwapFactoryNG>(
            {
                factory: ICurveStableSwapFactoryNG__factory,
                address,
            },
            rpcProvider,
        );
    },
    ICurveStableSwapNG: (address: string, rpcProvider: ProviderOrRunner) => {
        return new EvmContractSafe<ICurveStableSwapNG>(
            {
                factory: ICurveStableSwapNG__factory,
                address,
            },
            rpcProvider,
        );
    },
    UsdtOFT: (address: string, rpcProvider: ProviderOrRunner) => {
        return new EvmContractSafe<UsdtOFT>(
            {
                factory: UsdtOFT__factory,
                address,
            },
            rpcProvider,
        );
    },
    Aragon: (address: string, rpcProvider: ProviderOrRunner) => {
        return new EvmContractSafe<Aragon>(
            {
                factory: Aragon__factory,
                address,
            },
            rpcProvider,
        );
    },
} as const satisfies Record<
    ContractNameType,
    (address: string, rpcProvider: ProviderOrRunner) => EvmContractSafe<AllEvmContracts>
>;
