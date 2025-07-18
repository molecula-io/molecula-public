/* eslint-disable camelcase */

import type { JsonFragment } from 'ethers';

import {
    AccountantAgent__factory,
    AgentLZ__factory,
    ICurveStableSwapFactoryNG__factory,
    IERC20Basic__factory,
    IERC20Metadata__factory,
    ILayerZeroEndpointV2__factory,
    MoleculaPoolTreasury__factory,
    MUSDE__factory,
    MUSDLock__factory,
    IOracle__factory,
    RebaseToken__factory,
    SupplyManager__factory,
    UsdtOFT__factory,
    Executor__factory,
    RebaseTokenV2__factory,
    MoleculaPoolTreasuryV2__factory,
    SupplyManagerV2__factory,
    IMoleculaPoolV2__factory,
} from '@molecula-monorepo/solidity/typechain-types';

import {
    AavePool__factory,
    Curve__factory,
    ERC20__factory,
    ERC4626__factory,
    SparkPool__factory,
    StakedUSDe__factory,
    SavingsUSDS__factory,
    SFrxUSD__factory,
    Aragon__factory,
    ReceiveULN__factory,
} from '../../typechain';

import type { ContractNameType } from '../types';

const EvmAllContractsAbi: Record<ContractNameType, readonly JsonFragment[]> = {
    RebaseToken: RebaseToken__factory.abi,
    RebaseTokenV2: RebaseTokenV2__factory.abi,
    SupplyManager: SupplyManager__factory.abi,
    SupplyManagerV2: SupplyManagerV2__factory.abi,
    AgentLZ: AgentLZ__factory.abi,
    ERC20: ERC20__factory.abi,
    ERC4626: ERC4626__factory.abi,
    IERC20Basic: IERC20Basic__factory.abi,
    IERC20Metadata: IERC20Metadata__factory.abi,
    MUSDE: MUSDE__factory.abi,
    IMoleculaPoolV2: IMoleculaPoolV2__factory.abi,
    MoleculaPoolTreasury: MoleculaPoolTreasury__factory.abi,
    MoleculaPoolTreasuryV2: MoleculaPoolTreasuryV2__factory.abi,
    MUSDLock: MUSDLock__factory.abi,
    IOracle: IOracle__factory.abi,
    AccountantAgent: AccountantAgent__factory.abi,
    StakedUSDe: StakedUSDe__factory.abi,
    SavingsUSDS: SavingsUSDS__factory.abi,
    SFrxUSD: SFrxUSD__factory.abi,
    AavePool: AavePool__factory.abi,
    SparkPool: SparkPool__factory.abi,
    EndpointLZ: ILayerZeroEndpointV2__factory.abi,
    ExecutorLZ: Executor__factory.abi,
    SwapCurve: Curve__factory.abi,
    ICurveStableSwapFactoryNG: ICurveStableSwapFactoryNG__factory.abi,
    ICurveStableSwapNG: ICurveStableSwapFactoryNG__factory.abi,
    UsdtOFT: UsdtOFT__factory.abi,
    Aragon: Aragon__factory.abi,
    ReceiveULN: ReceiveULN__factory.abi,
} as const;

export const allContractAbi: JsonFragment[][] = Object.values(
    EvmAllContractsAbi,
) as JsonFragment[][];
