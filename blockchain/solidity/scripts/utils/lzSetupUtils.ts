import { AbiCoder } from 'ethers';
import { type TronWeb, type Contract as TronContract } from 'tronweb';

import { ethMainnetBetaConfig, sepoliaConfig } from '../../configs/ethereum';
import { tronMainnetBetaConfig } from '../../configs/tron/mainnetBetaTyped';
import { shastaConfig } from '../../configs/tron/shastaTyped';

import type { ILayerZeroEndpointV2 } from '../../typechain-types/@layerzerolabs/lz-evm-protocol-v2/contracts/interfaces/ILayerZeroEndpointV2';

// TRON_ALLOWED_REMOTE_EIDS contains first local TRON EIDs (self), then EIDs of remote Ethereum chains
const TRON_ALLOWED_REMOTE_EIDS = [
    // Local TRON EIDs
    shastaConfig.LAYER_ZERO_TRON_EID,
    tronMainnetBetaConfig.LAYER_ZERO_TRON_EID,
    // Remote Ethereum EIDs (used for cross-chain config validation)
    shastaConfig.LAYER_ZERO_ETHEREUM_EID,
    tronMainnetBetaConfig.LAYER_ZERO_ETHEREUM_EID,
];

// ETH_ALLOWED_REMOTE_EIDS contains first local Ethereum EIDs (self), then EIDs of remote TRON chains
const ETH_ALLOWED_REMOTE_EIDS = [
    // Local Ethereum EIDs
    sepoliaConfig.LAYER_ZERO_ETHEREUM_EID,
    ethMainnetBetaConfig.LAYER_ZERO_ETHEREUM_EID,
    // Remote TRON EIDs (used for cross-chain config validation)
    sepoliaConfig.LAYER_ZERO_TRON_EID,
    ethMainnetBetaConfig.LAYER_ZERO_TRON_EID,
];

// Executor config must have one of these maxMessageSize values
const ALLOWED_EXECUTOR_MSG_LEN = [10000n, 999n];

// ABI definitions for decoding executor/ULN configs
const ulnConfigStructType = [
    'tuple(uint64 confirmations, uint8 requiredDVNCount, uint8 optionalDVNCount, uint8 optionalDVNThreshold, address[] requiredDVNs, address[] optionalDVNs)',
];
const executorConfigAbi = ['tuple(uint32 maxMessageSize, address executorAddress)'];

const executorConfigType = 1; // 1 for executor
const ulnConfigType = 2; // 2 for UlnConfig

/**
 * Fetches and validates LayerZero OApp config for TRON-based networks.
 * Decodes both executor and ULN config structs from the LayerZero endpoint.
 */
export async function getTronOAppConfig(
    tronWeb: TronWeb,
    lzEndpoint: TronContract,
    remoteEid: number,
    oappAddress: string,
) {
    // Fetch send library address for this OApp and remote EID
    // @ts-ignore (Missing types for contracts)
    const sendLibRes = await lzEndpoint.getSendLibrary(oappAddress, remoteEid).call();
    const sendLibAddress = tronWeb.address.fromHex(sendLibRes[0]);
    console.log('Send Library:', sendLibAddress);

    // Fetch receive library address for this OApp and remote EID
    // @ts-ignore (Missing types for contracts)
    const receiveRes = await lzEndpoint.getReceiveLibrary(oappAddress, remoteEid).call();
    const receiveLibAddress = tronWeb.address.fromHex(receiveRes[0]);
    console.log('Receive Library:', receiveLibAddress);

    // Fetch and decode for sendLib (both Executor and ULN Config)
    const sendExecutorConfigBytes = (
        await lzEndpoint
            // @ts-ignore
            .getConfig(oappAddress, sendLibAddress, remoteEid, executorConfigType)
            .call()
    )[0];

    // @ts-ignore
    const executorConfigArray = tronWeb.utils.abi.decodeParams(
        [],
        executorConfigAbi,
        sendExecutorConfigBytes,
    );
    console.log('Send Library Executor Config:', executorConfigArray);

    if (
        TRON_ALLOWED_REMOTE_EIDS.includes(remoteEid) &&
        !ALLOWED_EXECUTOR_MSG_LEN.includes(executorConfigArray[0][0])
    ) {
        throw new Error(
            'Fix executorConfig into setSendConfig! Executor config does not match expected values',
        );
    }

    // Fetch and decode for sendLib ULN Config
    const sendUlnConfigBytes = (
        await lzEndpoint
            // @ts-ignore
            .getConfig(oappAddress, sendLibAddress, remoteEid, ulnConfigType)
            .call()
    )[0];

    // Decode the ULN config struct
    // @ts-ignore: type mismatch due to TronWeb decodeParams
    const sendUlnConfigArray = tronWeb.utils.abi.decodeParams(
        [],
        ulnConfigStructType,
        sendUlnConfigBytes,
    )[0];
    console.log('Send Library ULN Config:', sendUlnConfigArray);

    // Fetch ULN config bytes for receive library
    const receiveUlnConfigBytes = (
        await lzEndpoint
            // @ts-ignore: contract ABI typing not available
            .getConfig(oappAddress, receiveLibAddress, remoteEid, ulnConfigType)
            .call()
    )[0];
    // Decode the ULN config struct for receive library
    // @ts-ignore: type mismatch due to TronWeb decodeParams
    const receiveUlnConfigArray = tronWeb.utils.abi.decodeParams(
        [],
        ulnConfigStructType,
        receiveUlnConfigBytes,
    )[0];
    console.log('Receive Library ULN Config:', receiveUlnConfigArray);

    // Return both library addresses for further processing
    return { sendLibAddress, receiveLibAddress };
}

/**
 * Fetches and validates LayerZero OApp config for TRON-based networks.
 * Decodes both executor and ULN config structs from the LayerZero endpoint.
 */
export async function getOAppConfig(
    lzEndpoint: ILayerZeroEndpointV2,
    remoteEid: number,
    oappAddress: string,
) {
    // Create ABI coder
    const abiCoder = AbiCoder.defaultAbiCoder();

    // Fetch send library address for this OApp and remote EID
    const sendLibAddress = await lzEndpoint.getSendLibrary(oappAddress, remoteEid);
    console.log('Send Library:', sendLibAddress);

    // Fetch receive library address for this OApp and remote EID
    const receiveRes = await lzEndpoint.getReceiveLibrary(oappAddress, remoteEid);
    const receiveLibAddress = receiveRes.lib;
    console.log('Receive Library:', receiveLibAddress);

    // Fetch executor config bytes for send library
    const sendExecutorConfigBytes = await lzEndpoint.getConfig(
        oappAddress,
        sendLibAddress,
        remoteEid,
        executorConfigType,
    );

    // Decode the executor config struct using the ABI
    const executorConfigArray = abiCoder.decode(executorConfigAbi, sendExecutorConfigBytes);
    console.log('Send Library Executor Config:', executorConfigArray);

    // Validate: throw if not an allowed config for this remote EID
    if (
        ETH_ALLOWED_REMOTE_EIDS.includes(remoteEid) &&
        !ALLOWED_EXECUTOR_MSG_LEN.includes(executorConfigArray[0][0])
    ) {
        throw new Error(
            'Fix executorConfig into setSendConfig! Executor config does not match expected values',
        );
    }

    // Fetch ULN config bytes for send library
    const sendUlnConfigBytes = await lzEndpoint.getConfig(
        oappAddress,
        sendLibAddress,
        remoteEid,
        ulnConfigType,
    );

    // Decode the ULN config struct
    const sendUlnConfigArray = abiCoder.decode(ulnConfigStructType, sendUlnConfigBytes);
    console.log('Send Library ULN Config:', sendUlnConfigArray);

    // Fetch ULN config bytes for receive library
    const receiveUlnConfigBytes = await lzEndpoint.getConfig(
        oappAddress,
        receiveLibAddress,
        remoteEid,
        ulnConfigType,
    );
    // Decode the ULN config struct for receive library
    const receiveUlnConfigArray = abiCoder.decode(ulnConfigStructType, receiveUlnConfigBytes);
    console.log('Receive Library ULN Config:', receiveUlnConfigArray);

    // Return both library addresses for further processing
    return { sendLibAddress, receiveLibAddress };
}
