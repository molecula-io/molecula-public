import { DevnetContractsExecutor, EnvironmentType } from '@molecula-monorepo/blockchain.addresses';

import { ethMainnetBetaConfig } from '../ethereum/mainnetBetaTyped';
import { sepoliaConfig } from '../ethereum/sepoliaTyped';
import { tronMainnetBetaConfig } from '../tron/mainnetBetaTyped';
import { shastaConfig } from '../tron/shastaTyped';

import type { ExecutorConfig, UlnConfig, GasLimitsConfig } from './types';

/**
 * Configuration type identifiers.
 * - CONFIG_TYPE_EXECUTOR (1): Executor settings (max message size & executor address).
 * - CONFIG_TYPE_ULN      (2): ULN (Ultra Light Node) DVN settings (confirmations & DVN addresses).
 */
export const CONFIG_TYPE_EXECUTOR = 1;
export const CONFIG_TYPE_ULN = 2;

/**
 * layerZeroDVNConfigs maps each remote chain’s EID to:
 * - sendLibrary:    ULN config when sending messages _to_ that chain
 * - receiveLibrary: ULN config when receiving messages _from_ that chain
 * - executorConfig: Executor settings for processing messages on that chain
 *
 * References:
 * - Default protocol gas settings: https://docs.layerzero.network/v2/developers/evm/protocol-gas-settings/default-config#setting-send-config
 * - DVN address list:            https://docs.layerzero.network/v2/developers/evm/technical-reference/dvn-addresses
 */
export const layerZeroDVNConfigs: Record<
    number,
    {
        sendLibrary: { ulnConfig: UlnConfig };
        receiveLibrary: { ulnConfig: UlnConfig };
        executorConfig: ExecutorConfig;
    }
> = {
    // Sepolia → Tron testnet (devnet environment)
    [sepoliaConfig.LAYER_ZERO_TRON_EID]: {
        sendLibrary: {
            ulnConfig: {
                confirmations: 1,
                requiredDVNCount: sepoliaConfig.LAYER_ZERO_ETHEREUM_REQUIERED_DVNS.length,
                optionalDVNCount: 0,
                optionalDVNThreshold: 0,
                requiredDVNs: sepoliaConfig.LAYER_ZERO_ETHEREUM_REQUIERED_DVNS,
                optionalDVNs: [],
            },
        },
        receiveLibrary: {
            ulnConfig: {
                confirmations: 1,
                requiredDVNCount: sepoliaConfig.LAYER_ZERO_ETHEREUM_REQUIERED_DVNS.length,
                optionalDVNCount: 0,
                optionalDVNThreshold: 0,
                requiredDVNs: sepoliaConfig.LAYER_ZERO_ETHEREUM_REQUIERED_DVNS,
                optionalDVNs: [],
            },
        },
        executorConfig: {
            maxMessageSize: 10_000,
            executorAddress:
                !DevnetContractsExecutor.eth.executor || DevnetContractsExecutor.eth.executor === ''
                    ? sepoliaConfig.LAYER_ZERO_EXECUTOR
                    : DevnetContractsExecutor.eth.executor,
        },
    },
    // Shasta → Sepolia (devnet environment)
    [shastaConfig.LAYER_ZERO_ETHEREUM_EID]: {
        sendLibrary: {
            ulnConfig: {
                confirmations: 1,
                requiredDVNCount: shastaConfig.LAYER_ZERO_TRON_REQUIERED_DVNS.length,
                optionalDVNCount: 0,
                optionalDVNThreshold: 0,
                requiredDVNs: shastaConfig.LAYER_ZERO_TRON_REQUIERED_DVNS, // LayerZero Labs DVN address
                optionalDVNs: [],
            },
        },
        receiveLibrary: {
            ulnConfig: {
                confirmations: 1,
                requiredDVNCount: shastaConfig.LAYER_ZERO_TRON_REQUIERED_DVNS.length,
                optionalDVNCount: 0,
                optionalDVNThreshold: 0,
                requiredDVNs: shastaConfig.LAYER_ZERO_TRON_REQUIERED_DVNS, // LayerZero Labs DVN address
                optionalDVNs: [],
            },
        },
        executorConfig: {
            maxMessageSize: 10_000,
            executorAddress:
                !DevnetContractsExecutor.tron.executor ||
                DevnetContractsExecutor.tron.executor === ''
                    ? shastaConfig.LAYER_ZERO_TRON_EXECUTOR
                    : DevnetContractsExecutor.tron.executor,
        },
    },
    // Ethereum mainnet → Tron mainnet (beta environment)
    [ethMainnetBetaConfig.LAYER_ZERO_TRON_EID]: {
        sendLibrary: {
            ulnConfig: {
                confirmations: 15,
                requiredDVNCount: ethMainnetBetaConfig.LAYER_ZERO_ETHEREUM_REQUIERED_DVNS.length,
                optionalDVNCount: 0,
                optionalDVNThreshold: 0,
                requiredDVNs: ethMainnetBetaConfig.LAYER_ZERO_ETHEREUM_REQUIERED_DVNS,
                optionalDVNs: [],
            },
        },
        receiveLibrary: {
            ulnConfig: {
                confirmations: 5,
                requiredDVNCount: ethMainnetBetaConfig.LAYER_ZERO_ETHEREUM_REQUIERED_DVNS.length,
                optionalDVNCount: 0,
                optionalDVNThreshold: 0,
                requiredDVNs: ethMainnetBetaConfig.LAYER_ZERO_ETHEREUM_REQUIERED_DVNS,
                optionalDVNs: [],
            },
        },
        executorConfig: {
            maxMessageSize: 999,
            executorAddress: ethMainnetBetaConfig.LAYER_ZERO_EXECUTOR,
        },
    },
    // Tron mainnet → Ethereum mainnet (beta environment)
    [tronMainnetBetaConfig.LAYER_ZERO_ETHEREUM_EID]: {
        sendLibrary: {
            ulnConfig: {
                confirmations: 5,
                requiredDVNCount: tronMainnetBetaConfig.LAYER_ZERO_TRON_REQUIERED_DVNS.length,
                optionalDVNCount: 0,
                optionalDVNThreshold: 0,
                requiredDVNs: tronMainnetBetaConfig.LAYER_ZERO_TRON_REQUIERED_DVNS,
                optionalDVNs: [],
            },
        },
        receiveLibrary: {
            ulnConfig: {
                confirmations: 15,
                requiredDVNCount: tronMainnetBetaConfig.LAYER_ZERO_TRON_REQUIERED_DVNS.length,
                optionalDVNCount: 0,
                optionalDVNThreshold: 0,
                requiredDVNs: tronMainnetBetaConfig.LAYER_ZERO_TRON_REQUIERED_DVNS,
                optionalDVNs: [],
            },
        },
        executorConfig: {
            maxMessageSize: 999,
            executorAddress: tronMainnetBetaConfig.LAYER_ZERO_TRON_EXECUTOR,
        },
    },
};

/**
 * Gas limits configuration for agentLZ & accountantLZ OAPPs, keyed by environment.
 *
 * - agentGasLimits:    Gas budgets for on-chain “agentLZ” calls (confirmations, distributions, oracles).
 * - accountantGasLimits: Gas budgets for “accountantLZ” calls (deposit/redeem requests).
 *
 * EnvironmentType:
 * - devnet         : Test networks (default).
 * - mainnet/beta   : Pre-production mainnet.
 * - mainnet/prod   : Live production mainnet (to be configured after beta testing).
 */
export const OAPP_GAS_LIMITS_BY_ENV: Record<EnvironmentType, GasLimitsConfig> = {
    [EnvironmentType.devnet]: {
        agentGasLimits: [
            { msgType: 0x02, baseGas: 150_000, unitGas: 0 }, // CONFIRM_DEPOSIT
            { msgType: 0x04, baseGas: 150_000, unitGas: 50_000 }, // CONFIRM_REDEEM
            { msgType: 0x05, baseGas: 175_000, unitGas: 50_000 }, // DISTRIBUTE_YIELD
            { msgType: 0x06, baseGas: 170_000, unitGas: 0 }, // CONFIRM_DEPOSIT_AND_UPDATE_ORACLE
            { msgType: 0x07, baseGas: 200_000, unitGas: 50_000 }, // DISTRIBUTE_YIELD_AND_UPDATE_ORACLE
            { msgType: 0x08, baseGas: 71000, unitGas: 0 }, // UPDATE_ORACLE
        ],
        accountantGasLimits: [
            { msgType: 0x01, baseGas: 150_000, unitGas: 0 }, // REQUEST_DEPOSIT
            { msgType: 0x03, baseGas: 265_000, unitGas: 0 }, // REQUEST_REDEEM
        ],
    },
    [EnvironmentType['mainnet/beta']]: {
        agentGasLimits: [
            { msgType: 0x02, baseGas: 170_000, unitGas: 0 }, // CONFIRM_DEPOSIT
            { msgType: 0x04, baseGas: 150_000, unitGas: 50_000 }, // CONFIRM_REDEEM
            { msgType: 0x05, baseGas: 175_000, unitGas: 50_000 }, // DISTRIBUTE_YIELD
            { msgType: 0x06, baseGas: 200_000, unitGas: 0 }, // CONFIRM_DEPOSIT_AND_UPDATE_ORACLE
            { msgType: 0x07, baseGas: 200_000, unitGas: 50_000 }, // DISTRIBUTE_YIELD_AND_UPDATE_ORACLE
            { msgType: 0x08, baseGas: 71000, unitGas: 0 }, // UPDATE_ORACLE
        ],
        accountantGasLimits: [
            { msgType: 0x01, baseGas: 150_000, unitGas: 0 }, // REQUEST_DEPOSIT
            { msgType: 0x03, baseGas: 460_000, unitGas: 0 }, // REQUEST_REDEEM
        ],
    },
    // TO BE CONFIGURED AFTER BETA TESTING
    [EnvironmentType['mainnet/prod']]: {
        agentGasLimits: [
            { msgType: 0x02, baseGas: 0, unitGas: 0 }, // CONFIRM_DEPOSIT
            { msgType: 0x04, baseGas: 0, unitGas: 0 }, // CONFIRM_REDEEM
            { msgType: 0x05, baseGas: 0, unitGas: 0 }, // DISTRIBUTE_YIELD
            { msgType: 0x06, baseGas: 0, unitGas: 0 }, // CONFIRM_DEPOSIT_AND_UPDATE_ORACLE
            { msgType: 0x07, baseGas: 0, unitGas: 0 }, // DISTRIBUTE_YIELD_AND_UPDATE_ORACLE
            { msgType: 0x08, baseGas: 0, unitGas: 0 }, // UPDATE_ORACLE
        ],
        accountantGasLimits: [
            { msgType: 0x01, baseGas: 0, unitGas: 0 }, // REQUEST_DEPOSIT
            { msgType: 0x03, baseGas: 0, unitGas: 0 }, // REQUEST_REDEEM
        ],
    },
};
