// SPDX-License-Identifier: LZBL-1.2
// copied from https://github.com/LayerZero-Labs/LayerZero-v2/blob/main/packages/layerzero-v2/evm/messagelib/contracts/Executor.sol
pragma solidity ^0.8.23;

import {Origin} from "@layerzerolabs/lz-evm-protocol-v2/contracts/interfaces/ILayerZeroEndpointV2.sol";

/**
 * @dev Extended interface for LayerZero Endpoint v2 for message processing, composing, and alerting.
 */
interface ILayerZeroEndpointV2Extended {
    /**
     * @dev Returns the endpoint ID (EID) for this contract.
     * @return Endpoint EID (unique uint32 identifier)
     */
    function eid() external view returns (uint32);

    /**
     * @notice Receives and processes a cross-chain message.
     * @dev Called by Executor or LayerZero infrastructure to deliver a message.
     * @param _origin       Struct describing the source chain and sender.
     * @param _receiver     Destination receiver contract address.
     * @param _guid         Unique message GUID (32 bytes).
     * @param _message      Serialized message payload.
     * @param _extraData    Extra data (optional, may be empty).
     */
    function lzReceive(
        Origin calldata _origin,
        address _receiver,
        bytes32 _guid,
        bytes calldata _message,
        bytes calldata _extraData
    ) external payable;

    /**
     * @notice Alerts about a failed message delivery or execution attempt.
     * @dev Used for off-chain monitoring and reprocessing flows.
     * @param _origin       Struct describing the source chain and sender.
     * @param _receiver     Destination receiver contract address.
     * @param _guid         Unique message GUID (32 bytes).
     * @param _gas          Gas provided for the failed attempt.
     * @param _value        Native token value sent.
     * @param _message      Serialized message payload.
     * @param _extraData    Extra data passed during the call.
     * @param _reason       ABI-encoded revert reason or error data.
     */
    function lzReceiveAlert(
        Origin calldata _origin,
        address _receiver,
        bytes32 _guid,
        uint256 _gas,
        uint256 _value,
        bytes calldata _message,
        bytes calldata _extraData,
        bytes calldata _reason
    ) external;

    /**
     * @notice Composes (initiates) a new cross-chain message from one contract to another.
     * @dev Used for multi-hop or chained message execution.
     * @param _from         Originating contract address.
     * @param _to           Destination contract address.
     * @param _guid         Unique message GUID.
     * @param _index        Message sequence index for ordering.
     * @param _message      Serialized payload.
     * @param _extraData    Extra data (optional, may be empty).
     */
    function lzCompose(
        address _from,
        address _to,
        bytes32 _guid,
        uint16 _index,
        bytes calldata _message,
        bytes calldata _extraData
    ) external payable;

    /**
     * @notice Alerts about a failed compose attempt.
     * @dev Used for off-chain monitoring and diagnostics.
     * @param _from         Originating contract address.
     * @param _to           Destination contract address.
     * @param _guid         Unique message GUID.
     * @param _index        Message sequence index.
     * @param _gas          Gas provided for the failed attempt.
     * @param _value        Native token value sent.
     * @param _message      Serialized payload.
     * @param _extraData    Extra data passed during the call.
     * @param _reason       ABI-encoded revert reason or error data.
     */
    function lzComposeAlert(
        address _from,
        address _to,
        bytes32 _guid,
        uint16 _index,
        uint256 _gas,
        uint256 _value,
        bytes calldata _message,
        bytes calldata _extraData,
        bytes calldata _reason
    ) external;
}
