/*
 * LayerZero Configuration Verification Utilities
 *
 * This module contains utility functions for verifying LayerZero OApp configuration
 * including send/receive libraries, executor configs, and ULN configs.
 */

import { type HardhatRuntimeEnvironment } from 'hardhat/types';

import type { EnvironmentType } from '@molecula-monorepo/blockchain.addresses';

import {
    layerZeroDVNConfigs,
    CONFIG_TYPE_EXECUTOR,
    CONFIG_TYPE_ULN,
} from '../../../../configs/layerzero/omniConfig';
import type { EthereumNetworkConfig } from '../../../../configs/mUSD/ethereum/types';
import type { VerificationResult } from '../../../utils/configurationVerificationUtils';
import { checkValue, verifyValue } from '../../../utils/configurationVerificationUtils';
import { getOAppConfig } from '../../../utils/lzSetupUtils';

/**
 * Verifies LayerZero OApp configuration (sendConfig and receiveConfig)
 * Compares actual LayerZero endpoint configuration with expected configuration
 * @param hre - Hardhat runtime environment
 * @param oappAddress - OApp contract address to verify
 * @param remoteEid - Remote endpoint ID to verify configuration for
 * @param config - Configuration object containing LayerZero endpoint address
 * @param environment - Environment type for layerZeroDVNConfigs
 * @param results - Array to store verification results
 */
export async function verifyLayerZeroConfig(
    hre: HardhatRuntimeEnvironment,
    oappAddress: string,
    remoteEid: number,
    config: EthereumNetworkConfig,
    environment: EnvironmentType,
    results: VerificationResult[],
): Promise<void> {
    if (remoteEid <= 0) {
        throw new Error('Invalid remote EID provided');
    }

    // Get LayerZero endpoint contract
    const lzEndpoint = await hre.ethers.getContractAt(
        'ILayerZeroEndpointV2',
        config.LAYER_ZERO_ENDPOINT,
    );

    // Get expected configuration
    const expectedConfig = layerZeroDVNConfigs[environment][remoteEid];

    if (!expectedConfig) {
        results.push({
            variableName: `LayerZero Config (EID_${remoteEid})`,
            expectedValue: 'Configuration not found',
            actualValue: `No config found for remoteEid ${remoteEid}`,
            isMatch: false,
        });
        return;
    }

    // Fetch Send/Receive Library addresses using helper (same as in setup)
    const { sendLibAddress: actualSendLib, receiveLibAddress: actualReceiveLib } =
        await getOAppConfig(lzEndpoint, remoteEid, oappAddress);

    // Compare Send/Receive Library addresses against config
    results.push({
        variableName: `Send Library (EID_${remoteEid})`,
        ...checkValue(config.LAYER_ZERO_SEND_ULN_LIB, actualSendLib),
    });

    results.push({
        variableName: `Receive Library (EID_${remoteEid})`,
        ...checkValue(config.LAYER_ZERO_RECEIVE_ULN_LIB, actualReceiveLib),
    });

    // Verify send executor config
    const sendExecutorConfigBytes = await lzEndpoint.getConfig(
        oappAddress,
        actualSendLib,
        remoteEid,
        CONFIG_TYPE_EXECUTOR,
    );

    const abiCoder = hre.ethers.AbiCoder.defaultAbiCoder();
    const executorConfigArray = abiCoder.decode(
        ['tuple(uint32 maxMessageSize, address executorAddress)'],
        sendExecutorConfigBytes,
    );
    const actualExecutorConfig = executorConfigArray[0];

    results.push({
        variableName: `Send Executor Config (EID_${remoteEid})`,
        expectedValue: `maxMessageSize: ${expectedConfig.executorConfig.maxMessageSize}, executorAddress: ${expectedConfig.executorConfig.executorAddress}`,
        actualValue: `maxMessageSize: ${actualExecutorConfig.maxMessageSize}, executorAddress: ${actualExecutorConfig.executorAddress}`,
        isMatch:
            verifyValue(
                actualExecutorConfig.maxMessageSize,
                expectedConfig.executorConfig.maxMessageSize,
            ) &&
            verifyValue(
                actualExecutorConfig.executorAddress,
                expectedConfig.executorConfig.executorAddress,
            ),
    });

    // Verify send ULN config
    const sendUlnConfigBytes = await lzEndpoint.getConfig(
        oappAddress,
        actualSendLib,
        remoteEid,
        CONFIG_TYPE_ULN,
    );

    const sendUlnConfigArray = abiCoder.decode(
        [
            'tuple(uint64 confirmations, uint8 requiredDVNCount, uint8 optionalDVNCount, uint8 optionalDVNThreshold, address[] requiredDVNs, address[] optionalDVNs)',
        ],
        sendUlnConfigBytes,
    );
    const actualSendUlnConfig = sendUlnConfigArray[0];
    const expectedSendUlnConfig = expectedConfig.sendLibrary.ulnConfig;

    results.push({
        variableName: `Send ULN Config (EID_${remoteEid})`,
        expectedValue: `confirmations: ${expectedSendUlnConfig.confirmations}, requiredDVNCount: ${expectedSendUlnConfig.requiredDVNCount}`,
        actualValue: `confirmations: ${actualSendUlnConfig.confirmations}, requiredDVNCount: ${actualSendUlnConfig.requiredDVNCount}`,
        isMatch:
            verifyValue(actualSendUlnConfig.confirmations, expectedSendUlnConfig.confirmations) &&
            verifyValue(
                actualSendUlnConfig.requiredDVNCount,
                expectedSendUlnConfig.requiredDVNCount,
            ),
    });

    // Verify receive ULN config
    const receiveUlnConfigBytes = await lzEndpoint.getConfig(
        oappAddress,
        actualReceiveLib,
        remoteEid,
        CONFIG_TYPE_ULN,
    );

    const receiveUlnConfigArray = abiCoder.decode(
        [
            'tuple(uint64 confirmations, uint8 requiredDVNCount, uint8 optionalDVNCount, uint8 optionalDVNThreshold, address[] requiredDVNs, address[] optionalDVNs)',
        ],
        receiveUlnConfigBytes,
    );
    const actualReceiveUlnConfig = receiveUlnConfigArray[0];
    const expectedReceiveUlnConfig = expectedConfig.receiveLibrary.ulnConfig;

    results.push({
        variableName: `Receive ULN Config (EID_${remoteEid})`,
        expectedValue: `confirmations: ${expectedReceiveUlnConfig.confirmations}, requiredDVNCount: ${expectedReceiveUlnConfig.requiredDVNCount}`,
        actualValue: `confirmations: ${actualReceiveUlnConfig.confirmations}, requiredDVNCount: ${actualReceiveUlnConfig.requiredDVNCount}`,
        isMatch:
            verifyValue(
                actualReceiveUlnConfig.confirmations,
                expectedReceiveUlnConfig.confirmations,
            ) &&
            verifyValue(
                actualReceiveUlnConfig.requiredDVNCount,
                expectedReceiveUlnConfig.requiredDVNCount,
            ),
    });
}
