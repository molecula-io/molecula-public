import type { AddressLike } from 'ethers';
import type { HardhatRuntimeEnvironment } from 'hardhat/types';
import { TronWeb } from 'tronweb';

import type { EnvironmentType } from '@molecula-monorepo/blockchain.addresses';

import {
    CONFIG_TYPE_EXECUTOR,
    CONFIG_TYPE_ULN,
    layerZeroDVNConfigs,
} from '../../configs/layerzero/omniConfig';
import type { ILayerZeroEndpointV2 } from '../../typechain-types/@layerzerolabs/lz-evm-protocol-v2/contracts/interfaces/ILayerZeroEndpointV2';

/**
 * Sets the peer OAPP contract for cross-chain messaging on a source OAPP core contract.
 *
 * This function:
 * 1. Loads the IOAppCore contract at the given source address.
 * 2. Converts the peer’s Tron address into a 32-byte value (as required by the contract).
 * 3. Estimates gas for the `setPeer` call and applies a 20% buffer.
 * 4. Sends the transaction and waits for one confirmation.
 *
 * @param hre - The Hardhat runtime environment, for ethers and utilities.
 * @param sourceOAppAddress - The on-chain address of your local IOAppCore contract.
 * @param remoteEid - The LayerZero endpoint identifier (EID) of the remote chain.
 * @param peerOAppAddress - The address of the peer OAPP contract on the remote chain (Tron format).
 *
 * @throws If gas estimation or the transaction itself reverts.
 */
export async function setPeer(
    hre: HardhatRuntimeEnvironment,
    sourceOAppAddress: AddressLike,
    remoteEid: number,
    peerOAppAddress: AddressLike,
) {
    // 1) Attach to the IOAppCore contract at the source address
    const sourceContract = await hre.ethers.getContractAt('IOAppCore', sourceOAppAddress as string);
    // 2) Convert the peer’s Tron address to a 32-byte hex value:
    //    - TronWeb.address.toHex() returns "41" + 20-byte hex; replace leading "41" with "0x"
    //    - zeroPadValue pads/truncates to exactly 32 bytes for Solidity
    const addressInBytes32 = hre.ethers.zeroPadValue(
        TronWeb.address.toHex(peerOAppAddress as string).replace(/^(41)/, '0x') as string,
        32,
    );
    // 3) Estimate gas for setPeer(remoteEid, addressInBytes32) (throws if it would revert)
    const rawEstimate = await sourceContract.setPeer.estimateGas(remoteEid, addressInBytes32);
    //    Add a 20% buffer to the estimate to avoid out-of-gas
    const gasLimit = (rawEstimate * 120n) / 100n;

    // 4) Send the transaction with our buffered gas limit
    const tx = await sourceContract.setPeer(remoteEid, addressInBytes32, { gasLimit });
    console.log('Transaction sent:', tx.hash);

    // 5) Wait for one block confirmation (will throw if reverted)
    await tx.wait();
    console.log(`\tSet peer for the contract ${peerOAppAddress}.`);
}

export async function setUsdtOftFee(hre: HardhatRuntimeEnvironment, usdtOftAddress: AddressLike) {
    const sourceContract = await hre.ethers.getContractAt('UsdtOFT', usdtOftAddress as string);

    const response = await sourceContract.setFeeBps(10);
    await response.wait();
    console.log(`\tSet fee for the contract ${usdtOftAddress}.`);
}

export async function setEnforcedOptions(
    hre: HardhatRuntimeEnvironment,
    sourceOAppAddress: AddressLike,
    remoteEid: number,
    msgType: number,
    options: string,
) {
    const sourceContract = await hre.ethers.getContractAt(
        'IOAppOptionsType3',
        sourceOAppAddress as string,
    );
    const enforcedOptions = {
        eid: remoteEid,
        msgType,
        options,
    };
    const response = await sourceContract.setEnforcedOptions([enforcedOptions]);
    await response.wait();
    console.log(
        `\tSet enforced options for the contract ${sourceOAppAddress}, tx: ${response.hash}`,
    );
}

/**
 * Sets the “receiveUln302” configuration on a LayerZero endpoint by encoding and submitting
 * ULN (Ultra Light Node) parameters for a given remote chain.
 *
 * This function:
 * 1. Retrieves the pre-configured receiveLib ULN settings for the target chain (remoteEid).
 * 2. Encodes receiveUln302 config into the LayerZero‐expected tuple formats.
 * 3. Estimates gas for the `setConfig` call (and buffers it by +20%).
 * 4. Submits the transaction and waits for one confirmation.
 *
 * @param hre - The Hardhat runtime environment.
 * @param lzEndpoint - The `ILayerZeroEndpointV2` contract instance to call `setConfig` on.
 * @param remoteEid - The LayerZero Endpoint Identifier of the remote chain to configure.
 * @param oappAddress - The address of the “OAPP” on the local chain.
 * @param sendLibAddress - The address of the receiveUln302 library contract.
 *
 * @throws If there is no matching config for `remoteEid`, or if the transaction reverts.
 */
export async function setReceiveConfig(
    hre: HardhatRuntimeEnvironment,
    lzEndpoint: ILayerZeroEndpointV2,
    remoteEid: number,
    oappAddress: string,
    receiveLibAddress: string,
    environment: EnvironmentType,
) {
    // 1) Prepare the ABI coder for tuple encoding
    const abiCoder = hre.ethers.AbiCoder.defaultAbiCoder();
    // 2) Fetch pre-defined configs for this environment and remoteEid
    const envConfigs = layerZeroDVNConfigs[environment];
    if (!envConfigs) {
        throw new Error(`No configs found for environment ${environment}`);
    }

    const config = envConfigs[remoteEid];
    if (!config) {
        throw new Error(`No config found for remoteEid ${remoteEid} in environment ${environment}`);
    }

    // 3) Define the tuple types for ULN and Executor
    const configTypeUlnStruct =
        'tuple(uint64 confirmations, uint8 requiredDVNCount, uint8 optionalDVNCount, uint8 optionalDVNThreshold, address[] requiredDVNs, address[] optionalDVNs)';

    // 4) ABI-encode the ULN and Executor configs
    const encodedUlnConfig = abiCoder.encode(
        [configTypeUlnStruct],
        [config.receiveLibrary.ulnConfig],
    );

    // 5) Build the SetConfigParam structs for LayerZero’s `setConfig` call
    const setConfigParamUln = {
        eid: remoteEid,
        configType: CONFIG_TYPE_ULN,
        config: encodedUlnConfig,
    };

    // 6) Send the transaction
    try {
        // Estimate gas (this will throw if the call would revert) and add a small buffer (e.g. +20%).
        const rawEstimate = await lzEndpoint.setConfig.estimateGas(oappAddress, receiveLibAddress, [
            setConfigParamUln,
        ]);
        const gasLimit = (rawEstimate * 120n) / 100n;
        // Send the transaction with the estimated gas limit
        const tx = await lzEndpoint.setConfig(oappAddress, receiveLibAddress, [setConfigParamUln], {
            gasLimit,
        });
        console.log('Transaction sent:', tx.hash);
        // Wait for confirmation
        await tx.wait();
        console.log('Transaction confirmed!');
    } catch (error) {
        console.error('Transaction failed:', error);
    }
}

/**
 * Sets the “sendUln302” configuration on a LayerZero endpoint by encoding and submitting
 * both ULN (Ultra Light Node) and Executor parameters for a given remote chain.
 *
 * This function:
 * 1. Retrieves the pre-configured ULN & Executor settings for the target chain (remoteEid).
 * 2. Encodes both configs into the LayerZero‐expected tuple formats.
 * 3. Estimates gas for the `setConfig` call (and buffers it by +20%).
 * 4. Submits the transaction and waits for one confirmation.
 *
 * @param hre - The Hardhat runtime environment.
 * @param lzEndpoint - The `ILayerZeroEndpointV2` contract instance to call `setConfig` on.
 * @param remoteEid - The LayerZero Endpoint Identifier of the remote chain to configure.
 * @param oappAddress - The address of the “OAPP” on the local chain.
 * @param sendLibAddress - The address of the sendUln302 library contract.
 *
 * @throws If there is no matching config for `remoteEid`, or if the transaction reverts.
 */
export async function setSendConfig(
    hre: HardhatRuntimeEnvironment,
    lzEndpoint: ILayerZeroEndpointV2,
    remoteEid: number,
    oappAddress: string,
    sendLibAddress: string,
    environment: EnvironmentType,
) {
    // 1) Prepare the ABI coder for tuple encoding
    const abiCoder = hre.ethers.AbiCoder.defaultAbiCoder();
    // 2) Fetch pre-defined configs for this environment and remoteEid
    const envConfigs = layerZeroDVNConfigs[environment];
    if (!envConfigs) {
        throw new Error(`No configs found for environment ${environment}`);
    }

    const config = envConfigs[remoteEid];
    if (!config) {
        throw new Error(`No config found for remoteEid ${remoteEid} in environment ${environment}`);
    }

    // 3) Define the tuple types for ULN and Executor
    const configTypeUlnStruct =
        'tuple(uint64 confirmations, uint8 requiredDVNCount, uint8 optionalDVNCount, uint8 optionalDVNThreshold, address[] requiredDVNs, address[] optionalDVNs)';
    const configTypeExecutorStruct = 'tuple(uint32 maxMessageSize, address executorAddress)';

    // 4) ABI-encode the ULN and Executor configs
    const encodedUlnConfig = abiCoder.encode([configTypeUlnStruct], [config.sendLibrary.ulnConfig]);
    const encodedExecutorConfig = abiCoder.encode(
        [configTypeExecutorStruct],
        [config.executorConfig],
    );

    // 5) Build the SetConfigParam structs for LayerZero’s `setConfig` call
    const setConfigParamUln = {
        eid: remoteEid,
        configType: CONFIG_TYPE_ULN, // ULN_CONFIG_TYPE
        config: encodedUlnConfig,
    };

    const setConfigParamExecutor = {
        eid: remoteEid,
        configType: CONFIG_TYPE_EXECUTOR, // EXECUTOR_CONFIG_TYPE
        config: encodedExecutorConfig,
    };

    // 6) Send the transaction
    try {
        // Estimate gas (this will throw if the call would revert) and add a small buffer (e.g. +20%).
        const rawEstimate = await lzEndpoint.setConfig.estimateGas(oappAddress, sendLibAddress, [
            setConfigParamUln,
            setConfigParamExecutor,
        ]);
        const gasLimit = (rawEstimate * 120n) / 100n;
        // Send the transaction with the estimated gas limit
        const tx = await lzEndpoint.setConfig(
            oappAddress,
            sendLibAddress,
            [setConfigParamUln, setConfigParamExecutor], // Array of SetConfigParam structs
            {
                gasLimit,
            },
        );
        console.log('Transaction sent:', tx.hash);
        // Wait for confirmation
        await tx.wait();
        console.log('Transaction confirmed!');
    } catch (error) {
        console.error('Transaction failed:', error);
    }
}
