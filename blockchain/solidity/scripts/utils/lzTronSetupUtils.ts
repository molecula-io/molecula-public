import type { HardhatRuntimeEnvironment } from 'hardhat/types';
import type { TronWeb, Contract as TronContract } from 'tronweb';

import {
    CONFIG_TYPE_EXECUTOR,
    CONFIG_TYPE_ULN,
    layerZeroDVNConfigs,
} from '../../configs/layerzero/omniConfig';

export const REQUEST_DEPOSIT = '0x01';
export const CONFIRM_DEPOSIT = '0x02';
export const REQUEST_REDEEM = '0x03';
export const CONFIRM_REDEEM = '0x04';
export const DISTRIBUTE_YIELD = '0x05';
export const CONFIRM_DEPOSIT_AND_UPDATE_ORACLE = '0x06';
export const DISTRIBUTE_YIELD_AND_UPDATE_ORACLE = '0x07';
export const UPDATE_ORACLE = '0x08';

export async function setPeer(
    hre: HardhatRuntimeEnvironment,
    tronWeb: TronWeb,
    oappAddress: string,
    remoteEid: number,
    oAppRemoteAddress: string,
) {
    const artifact = await hre.artifacts.readArtifact('OAppCore');
    const oAppContract = tronWeb.contract(artifact.abi, oappAddress);
    const bytes32FromAddress = hre.ethers.zeroPadValue(oAppRemoteAddress, 32);
    // @ts-ignore
    await oAppContract.setPeer(remoteEid, bytes32FromAddress).send();
    console.log(`\tSet peer for the contract ${oappAddress}.`);
}

export async function setUsdtOftFee(
    hre: HardhatRuntimeEnvironment,
    tronWeb: TronWeb,
    usdtOftAddress: string,
) {
    const artifact = await hre.artifacts.readArtifact('UsdtOFT');
    const usdtOftContract = tronWeb.contract(artifact.abi, usdtOftAddress);
    // @ts-ignore
    await usdtOftContract.setFeeBps(10).send();
    console.log(`\tSet fee for the contract ${usdtOftAddress}.`);
}

// @ts-ignore
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function setReceiveConfig(
    tronWeb: TronWeb,
    lzEndpoint: TronContract,
    remoteEid: number,
    oappAddress: string,
    receiveLibAddress: string,
) {
    const config = layerZeroDVNConfigs[remoteEid];
    if (!config) {
        throw new Error(`No config found for remoteEid ${remoteEid}`);
    }

    // Encode UlnConfig using defaultAbiCoder
    const configTypeUlnStruct =
        'tuple(uint64 confirmations, uint8 requiredDVNCount, uint8 optionalDVNCount, uint8 optionalDVNThreshold, address[] requiredDVNs, address[] optionalDVNs)';
    // @ts-ignore
    const encodedUlnConfig = tronWeb.utils.abi.encodeParams(
        [configTypeUlnStruct],
        [config.receiveLibrary.ulnConfig],
    );

    // Define the SetConfigParam
    const setConfigParam = [
        remoteEid,
        CONFIG_TYPE_ULN, // RECEIVE_CONFIG_TYPE
        encodedUlnConfig,
    ];
    try {
        const tx = await lzEndpoint
            // @ts-ignore
            .setConfig(oappAddress, receiveLibAddress, [setConfigParam])
            .send();
        console.log('Transaction sent:', tx);
    } catch (error) {
        console.error('Transaction failed:', error);
    }
}

// @ts-ignore
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function setSendConfig(
    tronWeb: TronWeb,
    lzEndpoint: TronContract,
    remoteEid: number,
    oappAddress: string,
    sendLibAddress: string,
) {
    const config = layerZeroDVNConfigs[remoteEid];
    if (!config) {
        throw new Error(`No config found for remoteEid ${remoteEid}`);
    }

    // Encode UlnConfig using defaultAbiCoder
    const configTypeUlnStruct =
        'tuple(uint64 confirmations, uint8 requiredDVNCount, uint8 optionalDVNCount, uint8 optionalDVNThreshold, address[] requiredDVNs, address[] optionalDVNs)';
    // @ts-ignore
    const encodedUlnConfig = tronWeb.utils.abi.encodeParams(
        [configTypeUlnStruct],
        [config.sendLibrary.ulnConfig],
    );

    // Encode ExecutorConfig using defaultAbiCoder
    const configTypeExecutorStruct = 'tuple(uint32 maxMessageSize, address executorAddress)';
    // @ts-ignore
    const encodedExecutorConfig = tronWeb.utils.abi.encodeParams(
        [configTypeExecutorStruct],
        [config.executorConfig],
    );

    // Define the SetConfigParam structs
    const setConfigParamUln = [
        remoteEid,
        CONFIG_TYPE_ULN, // ULN_CONFIG_TYPE
        encodedUlnConfig,
    ];

    const setConfigParamExecutor = [
        remoteEid,
        CONFIG_TYPE_EXECUTOR, // EXECUTOR_CONFIG_TYPE
        encodedExecutorConfig,
    ];

    // Send the transaction
    try {
        const tx = await lzEndpoint
            // @ts-ignore
            .setConfig(
                oappAddress,
                sendLibAddress,
                [setConfigParamUln, setConfigParamExecutor], // Array of SetConfigParam structs
            )
            .send();
        console.log('Transaction sent:', tx);
    } catch (error) {
        console.error('Transaction failed:', error);
    }
}
