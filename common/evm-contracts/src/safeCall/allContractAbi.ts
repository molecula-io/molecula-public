/* eslint-disable camelcase */

import type { JsonFragment } from 'ethers';

import {
    AccountantAgent__factory,
    AgentLZ__factory,
    CommonTokenVault__factory,
    Executor__factory,
    IAgent__factory,
    ICurveStableSwapFactoryNG__factory,
    IERC20Basic__factory,
    IERC20Metadata__factory,
    ILayerZeroEndpointV2__factory,
    IMoleculaPoolV2__factory,
    IOracle__factory,
    MoleculaPoolTreasury__factory,
    MoleculaPoolTreasuryV2__factory,
    MUSDE__factory,
    MUSDLock__factory,
    NativeTokenVault__factory,
    NitrogenTokenVault__factory,
    RebaseToken__factory,
    RebaseTokenV2__factory,
    ShareToken__factory,
    SupplyManager__factory,
    SupplyManagerV2__factory,
    TokenVault__factory,
    UsdtOFT__factory,
} from '@molecula-monorepo/solidity/typechain-types';

import {
    AavePool__factory,
    Aragon__factory,
    Curve__factory,
    ERC20__factory,
    ERC4626__factory,
    ReceiveULN__factory,
    SavingsUSDS__factory,
    SendULN__factory,
    SFrxUSD__factory,
    SparkPool__factory,
    StakedUSDe__factory,
} from '../../typechain';

import type { ContractNameType } from '../types';

const EvmAllContractsAbi: Record<ContractNameType, readonly JsonFragment[]> = {
    AavePool: AavePool__factory.abi,
    AccountantAgent: AccountantAgent__factory.abi,
    AgentLZ: AgentLZ__factory.abi,
    Aragon: Aragon__factory.abi,
    CommonTokenVault: CommonTokenVault__factory.abi,
    EndpointLZ: ILayerZeroEndpointV2__factory.abi,
    ERC20: ERC20__factory.abi,
    ERC4626: ERC4626__factory.abi,
    ExecutorLZ: Executor__factory.abi,
    IAgent: IAgent__factory.abi,
    ICurveStableSwapFactoryNG: ICurveStableSwapFactoryNG__factory.abi,
    ICurveStableSwapNG: ICurveStableSwapFactoryNG__factory.abi,
    IERC20Basic: IERC20Basic__factory.abi,
    IERC20Metadata: IERC20Metadata__factory.abi,
    IMoleculaPoolV2: IMoleculaPoolV2__factory.abi,
    IOracle: IOracle__factory.abi,
    MoleculaPoolTreasury: MoleculaPoolTreasury__factory.abi,
    MoleculaPoolTreasuryV2: MoleculaPoolTreasuryV2__factory.abi,
    MUSDE: MUSDE__factory.abi,
    MUSDLock: MUSDLock__factory.abi,
    NativeTokenVault: NativeTokenVault__factory.abi,
    NitrogenTokenVault: NitrogenTokenVault__factory.abi,
    RebaseToken: RebaseToken__factory.abi,
    RebaseTokenV2: RebaseTokenV2__factory.abi,
    ReceiveULN: ReceiveULN__factory.abi,
    SavingsUSDS: SavingsUSDS__factory.abi,
    SendULN: SendULN__factory.abi,
    SFrxUSD: SFrxUSD__factory.abi,
    ShareToken: ShareToken__factory.abi,
    SparkPool: SparkPool__factory.abi,
    StakedUSDe: StakedUSDe__factory.abi,
    SupplyManager: SupplyManager__factory.abi,
    SupplyManagerV2: SupplyManagerV2__factory.abi,
    SwapCurve: Curve__factory.abi,
    TokenVault: TokenVault__factory.abi,
    UsdtOFT: UsdtOFT__factory.abi,
} as const;

export const allContractAbi: JsonFragment[][] = Object.values(
    EvmAllContractsAbi,
) as JsonFragment[][];
