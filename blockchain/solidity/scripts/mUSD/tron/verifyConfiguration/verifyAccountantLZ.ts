/*
 * AccountantLZ Contract Verification Module for Tron
 *
 * This module contains functions for verifying AccountantLZ contract configuration
 * on Tron networks. It handles LayerZero endpoint verification, peer configuration,
 * gas limits, and OApp configuration validation.
 */
/* eslint-disable no-await-in-loop, no-restricted-syntax */
import { type HardhatRuntimeEnvironment } from 'hardhat/types';
import type { Contract as TronContract } from 'tronweb';

import type { EnvironmentType, ContractsCarbon } from '@molecula-monorepo/blockchain.addresses';

import { APPROVER_SALT, SMALL_DELAY, DOUBLE_DELAY } from '../../../../configs';
import {
    OAPP_GAS_LIMITS_BY_ENV,
    layerZeroDVNConfigs,
} from '../../../../configs/layerzero/omniConfig';
import type { TronNetworkConfig } from '../../../../configs/mUSD/tron/types';
import type {
    VerificationResult,
    ContractVerification,
} from '../../../utils/configurationVerificationUtils';
import { addDelay, checkValue, verifyValue } from '../../../utils/configurationVerificationUtils';
import { getTronOAppConfig } from '../../../utils/lzSetupUtils';

import { verifyGasLimits } from './verifyGasLimits';

/**
 * Verifies AccountantLZ contract configuration
 */
export async function verifyAccountantLZContract(
    hre: HardhatRuntimeEnvironment,
    contractAddress: string,
    config: TronNetworkConfig,
    environment: EnvironmentType,
    contracts: ContractsCarbon,
): Promise<ContractVerification> {
    console.log(`\n📋 Verifying AccountantLZ contract: ${contractAddress}`);

    const artifact = await hre.artifacts.readArtifact('AccountantLZ');
    const accountantLZ = hre.tronweb.contract(artifact.abi, contractAddress) as TronContract;

    const results: VerificationResult[] = [];

    // Verify initialOwner
    const expectedOwner = hre.tronweb.address.fromHex(
        await accountantLZ.methods.owner?.().call({
            // @ts-ignore (passing private option)
            _isConstant: true,
        }),
    );
    results.push({
        variableName: 'owner',
        ...checkValue(config.OWNER, expectedOwner),
    });

    // Verify authorizedLZConfiguratorAddress
    const expectedAuthorizedLZConfigurator = hre.tronweb.address.fromHex(
        await accountantLZ.methods.authorizedLZConfigurator?.().call({
            // @ts-ignore (passing private option)
            _isConstant: true,
        }),
    );
    results.push({
        variableName: 'authorizedLZConfiguratorAddress',
        ...checkValue(
            config.ACCOUNTANT_AUTHORIZED_LZ_CONFIGURATOR,
            expectedAuthorizedLZConfigurator,
        ),
    });

    // Verify endpoint
    const expectedEndpoint = hre.tronweb.address.fromHex(
        await accountantLZ.methods.endpoint?.().call({
            // @ts-ignore (passing private option)
            _isConstant: true,
        }),
    );
    results.push({
        variableName: 'endpoint',
        ...checkValue(config.LAYER_ZERO_TRON_ENDPOINT, expectedEndpoint),
    });

    // Verify DST_EID (LayerZero destination chain ID)
    const dstEid = await accountantLZ.methods.DST_EID?.().call({
        // @ts-ignore (passing private option)
        _isConstant: true,
    });
    await addDelay(SMALL_DELAY); // Add delay to avoid rate limiting
    results.push({
        variableName: 'DST_EID',
        ...checkValue(config.LAYER_ZERO_ETHEREUM_EID, dstEid),
    });

    // Verify USDT address
    const usdtAddress = hre.tronweb.address.fromHex(
        await accountantLZ.methods.USDT?.().call({
            // @ts-ignore (passing private option)
            _isConstant: true,
        }),
    );
    await addDelay(SMALL_DELAY); // Add delay to avoid rate limiting
    results.push({
        variableName: 'USDT',
        ...checkValue(config.USDT_ADDRESS, usdtAddress),
    });

    // Verify USDT_OFT address
    const usdtOftAddress = hre.tronweb.address.fromHex(
        await accountantLZ.methods.USDT_OFT?.().call({
            // @ts-ignore (passing private option)
            _isConstant: true,
        }),
    );
    await addDelay(SMALL_DELAY); // Add delay to avoid rate limiting
    results.push({
        variableName: 'USDT_OFT',
        ...checkValue(config.USDT_OFT, usdtOftAddress),
    });

    // Verify Oracle address
    const oracleAddress = hre.tronweb.address.fromHex(
        await accountantLZ.methods.oracle?.().call({
            // @ts-ignore (passing private option)
            _isConstant: true,
        }),
    );
    await addDelay(SMALL_DELAY); // Add delay to avoid rate limiting
    results.push({
        variableName: 'oracle',
        ...checkValue(contracts.tron.oracle, oracleAddress),
    });

    // Verify underlying token
    const underlyingToken = hre.tronweb.address.fromHex(
        await accountantLZ.methods.underlyingToken?.().call({
            // @ts-ignore (passing private option)
            _isConstant: true,
        }),
    );
    results.push({
        variableName: 'underlyingToken',
        ...checkValue(contracts.tron.rebaseToken, underlyingToken),
    });

    // Verify LayerZero peer configuration
    const peer = await accountantLZ.methods.peers?.(config.LAYER_ZERO_ETHEREUM_EID).call({
        // @ts-ignore (passing private option)
        _isConstant: true,
    });

    // Convert expected agentLZ address to bytes32 format (like in setOAppPeer)
    // Get AgentLZ address from deployed contracts
    const expectedAgentLZAddress = contracts.eth.agentLZ;
    const expectedPeerBytes32 = expectedAgentLZAddress
        ? hre.ethers.zeroPadValue(expectedAgentLZAddress, 32)
        : APPROVER_SALT;
    // Normalize peer to hex string (TronWeb may return an array)
    let peerHex: string;
    const raw = Array.isArray(peer) ? peer[0] : peer;
    if (typeof raw === 'string') {
        peerHex = raw.startsWith('0x') ? raw : `0x${raw}`;
    } else {
        peerHex = hre.ethers.hexlify(raw as string);
    }
    results.push({
        variableName: 'peers(ETHEREUM_EID)',
        ...checkValue(expectedPeerBytes32, peerHex),
    });

    // Verify Gas Limits configuration
    const gasLimitsConfig = OAPP_GAS_LIMITS_BY_ENV[environment];
    await verifyGasLimits(accountantLZ, gasLimitsConfig.accountantGasLimits, results);
    await addDelay(DOUBLE_DELAY); // Additional delay after gas limits verification

    // Verify LayerZero OApp configuration (peer/send/receive config)
    const lzEndpointAbi = (await hre.artifacts.readArtifact('ILayerZeroEndpointV2')).abi;
    const lzEndpoint = hre.tronweb.contract(lzEndpointAbi, config.LAYER_ZERO_TRON_ENDPOINT);

    // Fetch send/receive libraries via helper (same as setup)
    const { sendLibAddress, receiveLibAddress } = await getTronOAppConfig(
        hre.tronweb,
        lzEndpoint,
        config.LAYER_ZERO_ETHEREUM_EID,
        contractAddress,
    );

    // Compare against expected DVN config library presence
    const expected = layerZeroDVNConfigs[environment][config.LAYER_ZERO_ETHEREUM_EID] || null;
    results.push({
        variableName: `Send Library (EID_${config.LAYER_ZERO_ETHEREUM_EID})`,
        ...checkValue(config.LAYER_ZERO_SEND_ULN_LIB, sendLibAddress),
    });

    results.push({
        variableName: `Receive Library (EID_${config.LAYER_ZERO_ETHEREUM_EID})`,
        ...checkValue(config.LAYER_ZERO_RECEIVE_ULN_LIB, receiveLibAddress),
    });

    // Verify ULN and Executor configs roughly against expected layerZeroDVNConfigs
    const configTypeUlnStruct =
        'tuple(uint64 confirmations, uint8 requiredDVNCount, uint8 optionalDVNCount, uint8 optionalDVNThreshold, address[] requiredDVNs, address[] optionalDVNs)';
    const executorConfigAbi = ['tuple(uint32 maxMessageSize, address executorAddress)'];

    const sendExecutorConfigBytes = (
        await lzEndpoint.methods
            .getConfig?.(contractAddress, sendLibAddress, config.LAYER_ZERO_ETHEREUM_EID, 1)
            ?.call()
    )?.[0] as string;

    const decodedExec = hre.tronweb.utils.abi.decodeParams(
        [],
        executorConfigAbi,
        sendExecutorConfigBytes,
    );
    const maxMessageSize = decodedExec[0][0]?.toString?.() || decodedExec[0][0];
    const executorAddress = decodedExec[0][1];
    results.push({
        variableName: `Send Executor Config (EID_${config.LAYER_ZERO_ETHEREUM_EID})`,
        expectedValue: expected
            ? `maxMessageSize: ${expected.executorConfig.maxMessageSize}, executorAddress: ${expected.executorConfig.executorAddress}`
            : 'missing expected',
        actualValue: `maxMessageSize: ${maxMessageSize}, executorAddress: ${executorAddress}`,
        isMatch:
            !!expected &&
            verifyValue(maxMessageSize, expected.executorConfig.maxMessageSize) &&
            verifyValue(executorAddress, expected.executorConfig.executorAddress),
    });

    const sendUlnConfigBytes = (
        await lzEndpoint.methods
            .getConfig?.(contractAddress, sendLibAddress, config.LAYER_ZERO_ETHEREUM_EID, 2)
            ?.call()
    )?.[0] as string;

    const decodedUln = hre.tronweb.utils.abi.decodeParams(
        [],
        [configTypeUlnStruct],
        sendUlnConfigBytes,
    );
    const confirmations = decodedUln[0][0]?.toString?.() || decodedUln[0][0];
    const requiredDVNCount = decodedUln[0][1]?.toString?.() || decodedUln[0][1];
    results.push({
        variableName: `Send ULN Config (EID_${config.LAYER_ZERO_ETHEREUM_EID})`,
        expectedValue: expected
            ? `confirmations: ${expected.sendLibrary.ulnConfig.confirmations}, requiredDVNCount: ${expected.sendLibrary.ulnConfig.requiredDVNCount}`
            : 'missing expected',
        actualValue: `confirmations: ${confirmations}, requiredDVNCount: ${requiredDVNCount}`,
        isMatch:
            !!expected &&
            verifyValue(confirmations, expected.sendLibrary.ulnConfig.confirmations) &&
            verifyValue(requiredDVNCount, expected.sendLibrary.ulnConfig.requiredDVNCount),
    });

    return {
        contractAddress,
        contractName: 'AccountantLZ',
        results,
    };
}
