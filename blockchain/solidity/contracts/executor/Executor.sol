// SPDX-License-Identifier: LZBL-1.2
// copied and modified from https://github.com/LayerZero-Labs/LayerZero-v2/blob/main/packages/layerzero-v2/evm/messagelib/contracts/Executor.sol
pragma solidity ^0.8.24;
import {IExecutor} from "@layerzerolabs/lz-evm-messagelib-v2/contracts/interfaces/IExecutor.sol";
import {IExecutorFeeLib} from "@layerzerolabs/lz-evm-messagelib-v2/contracts/interfaces/IExecutorFeeLib.sol";
import {IReceiveUlnE2} from "@layerzerolabs/lz-evm-messagelib-v2/contracts/uln/interfaces/IReceiveUlnE2.sol";
import {Origin, ILayerZeroEndpointV2} from "@layerzerolabs/lz-evm-protocol-v2/contracts/interfaces/ILayerZeroEndpointV2.sol";
import {PacketV1Codec} from "@layerzerolabs/lz-evm-protocol-v2/contracts/messagelib/libs/PacketV1Codec.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ILayerZeroEndpointV2Extended} from "./interfaces/ILayerZeroEndpointV2Extended.sol";
import {IReceiveUlnView, VerificationState, ExecutionState} from "./interfaces/ILayerZeroReceiveUlnView.sol";
import {Worker} from "./Worker.sol";

/// @title Executor Contract
/// @notice Executes LayerZero V2 operations and handles job fee logic for messaging libraries
/// @dev Extends Worker, ReentrancyGuard, and implements IExecutor
contract Executor is Worker, ReentrancyGuard, IExecutor {
    using PacketV1Codec for bytes;

    /// @dev Represents an empty payload hash.
    bytes32 public constant EMPTY_PAYLOAD_HASH = bytes32(0);

    /// @dev Represents a nil (max value) payload hash.
    bytes32 public constant NIL_PAYLOAD_HASH = bytes32(type(uint256).max);

    /// @dev Configuration per destination endpoint ID
    mapping(uint32 dstEid => DstConfig) public dstConfig;

    /// @dev LayerZero V2 endpoint address
    address public immutable ENDPOINT;

    /// @dev Local endpoint ID for LayerZero V2
    uint32 public immutable LOCAL_EID_V2;

    /// @dev LayerZero V2 ReceiveUln302 contract address
    address public immutable RECEIVE_ULN302;

    /// @dev Error thrown when a DVN verification is still in progress
    error Executor_Verifying();

    /// @dev Error thrown when the provided payload hash is invalid.
    error Executor_InvalidPayloadHash();

    /**
     * @dev Initializes the Executor contract with endpoint, ULN302, admin, and libraries.
     * @param _endpoint Address of LayerZeroV2 endpoint contract.
     * @param _receiveUln302 LayerZeroV2 RecieveUln302 contract address to commit verifications.
     * @param _messageLibs Addresses of messaging fee libraries allowed for job assignment.
     * @param _priceFeed Address of price feed contract used for fee calculations.
     * @param _roleAdmin Address assigned DEFAULT_ADMIN_ROLE.
     * @param _admins Additional addresses to be granted ADMIN_ROLE.
     */
    constructor(
        address _endpoint,
        address _receiveUln302,
        address[] memory _messageLibs,
        address _priceFeed,
        address _roleAdmin,
        address[] memory _admins
    ) Worker(_messageLibs, _priceFeed, 12000, _roleAdmin, _admins) {
        ENDPOINT = _endpoint;
        LOCAL_EID_V2 = ILayerZeroEndpointV2Extended(_endpoint).eid();
        RECEIVE_ULN302 = _receiveUln302;
    }

    /**
     * @dev Sets configuration parameters for multiple destination EIDs
     * This function allows the ADMIN_ROLE to set various parameters for each destination EID.
     * It updates the `dstConfig` mapping with new values for each destination EID.
     * @param _params Array of DstConfigParam structs containing destination settings
     * Emits `DstConfigSet` event with the updated parameters
     */
    function setDstConfig(DstConfigParam[] calldata _params) external onlyRole(_ADMIN_ROLE) {
        uint256 paramsLength = _params.length;
        for (uint256 i = 0; i < paramsLength; ++i) {
            // Write each destination config into the mapping, overwriting any previous value.
            DstConfigParam memory param = _params[i];
            dstConfig[param.dstEid] = DstConfig(
                param.lzReceiveBaseGas,
                param.multiplierBps,
                param.floorMarginUSD,
                param.nativeCap,
                param.lzComposeBaseGas
            );
        }
        emit DstConfigSet(_params);
    }

    /**
     * @dev Sends native tokens to specified addresses on target chain
     * It can only be called by an address with ADMIN_ROLE and is protected against reentrancy attacks.
     * @param _origin Origin information for the message context
     * @param _dstEid Destination endpoint EID where native tokens should be dropped
     * @param _oapp Address of the target OApp contract on the destination chain
     * @param _nativeDropParams Array of NativeDropParams specifying receivers and amounts
     * @param _nativeDropGasLimit Gas limit for each native transfer call
     */
    function nativeDrop(
        Origin calldata _origin,
        uint32 _dstEid,
        address _oapp,
        NativeDropParams[] calldata _nativeDropParams,
        uint256 _nativeDropGasLimit
    ) external payable onlyRole(_ADMIN_ROLE) nonReentrant {
        // Internal call ensures event is emitted and total spent is tracked
        _nativeDrop(_origin, _dstEid, _oapp, _nativeDropParams, _nativeDropGasLimit);
    }

    /**
     * @dev Commits a packet verification to the ReceiveUln302 contract
     * It checks the verification state of the packet header and payload hash.
     * If the packet is in a verifiable state, it commits the verification.
     * If the packet is in a verifying state, it reverts with LzExecutor_Verifying error.
     * @param _packetHeader Encoded packet header bytes
     * @param _payloadHash Keccak256 hash of the packet payload
     */
    function commitVerification(
        bytes calldata _packetHeader,
        bytes32 _payloadHash
    ) external nonReentrant {
        VerificationState verificationState = verifiable(_packetHeader, _payloadHash);
        if (verificationState == VerificationState.Verifiable) {
            // Verification passed, commit to the verifier contract
            IReceiveUlnE2(RECEIVE_ULN302).commitVerification(_packetHeader, _payloadHash);
        } else if (verificationState == VerificationState.Verifying) {
            // Revert if a Packet is still being verified by DVN/quorum
            revert Executor_Verifying();
        }
    }

    /**
     * @notice Executes LayerZero V2 receive logic (lzReceive)
     * @dev This function is used to execute messages received from LayerZero V2.
     * It wraps the call in a try/catch block to handle any errors that may occur.
     * @param _executionParams Struct containing origin, receiver, guid, message, extraData, and gasLimit.
     */
    function execute302(ExecutionParams calldata _executionParams) external payable nonReentrant {
        try
            ILayerZeroEndpointV2Extended(ENDPOINT).lzReceive{
                value: msg.value,
                gas: _executionParams.gasLimit
            }(
                _executionParams.origin,
                _executionParams.receiver,
                _executionParams.guid,
                _executionParams.message,
                _executionParams.extraData
            )
        // solhint-disable-next-line no-empty-blocks
        {
            // do nothing
        } catch (bytes memory reason) {
            // On error, call alert on the endpoint for logging.
            ILayerZeroEndpointV2Extended(ENDPOINT).lzReceiveAlert(
                _executionParams.origin,
                _executionParams.receiver,
                _executionParams.guid,
                _executionParams.gasLimit,
                msg.value,
                _executionParams.message,
                _executionParams.extraData,
                reason
            );
        }
    }

    /**
     * @notice Composes LayerZero V2 packets (lzCompose).
     * @dev This function is used to compose messages for LayerZero V2.
     * It wraps the call in a try/catch block to handle any errors that may occur.
     * @param _from Address from which the message originates.
     * @param _to Address to which the message is destined.
     * @param _guid Unique GUID for this message.
     * @param _index Sequence index for multi-packet messages.
     * @param _message Payload to send.
     * @param _extraData Additional data for the endpoint.
     * @param _gasLimit Gas limit provided for lzCompose.
     */
    function compose302(
        address _from,
        address _to,
        bytes32 _guid,
        uint16 _index,
        bytes calldata _message,
        bytes calldata _extraData,
        uint256 _gasLimit
    ) external payable nonReentrant {
        try
            ILayerZeroEndpointV2Extended(ENDPOINT).lzCompose{value: msg.value, gas: _gasLimit}(
                _from,
                _to,
                _guid,
                _index,
                _message,
                _extraData
            )
        // solhint-disable-next-line no-empty-blocks
        {
            // do nothing
        } catch (bytes memory reason) {
            ILayerZeroEndpointV2Extended(ENDPOINT).lzComposeAlert(
                _from,
                _to,
                _guid,
                _index,
                _gasLimit,
                msg.value,
                _message,
                _extraData,
                reason
            );
        }
    }

    /**
     * @dev Executes a native drop then LayerZero V2 receive logic in a single transaction.
     * This function allows for a native drop to be performed before executing the LayerZero V2 receive logic.
     * It combines the native drop and lzReceive into a single transaction to save on gas
     * and ensure atomicity of the operations.
     * This function can only be called by an address with ADMIN_ROLE and is protected against reentrancy attacks.
     * @param _nativeDropParams Array of NativeDropParams for native drop.
     * @param _nativeDropGasLimit Gas limit for each native transfer.
     * @param _executionParams Struct containing parameters for lzReceive.
     */
    function nativeDropAndExecute302(
        NativeDropParams[] calldata _nativeDropParams,
        uint256 _nativeDropGasLimit,
        ExecutionParams calldata _executionParams
    ) external payable onlyRole(_ADMIN_ROLE) nonReentrant {
        // Spend as much of msg.value as needed for drops; leftover is used for receive.
        uint256 spent = _nativeDrop(
            _executionParams.origin,
            LOCAL_EID_V2,
            _executionParams.receiver,
            _nativeDropParams,
            _nativeDropGasLimit
        );

        // Only remaining value is used for the receive call.
        uint256 value = msg.value - spent;
        try
            ILayerZeroEndpointV2Extended(ENDPOINT).lzReceive{
                value: value,
                gas: _executionParams.gasLimit
            }(
                _executionParams.origin,
                _executionParams.receiver,
                _executionParams.guid,
                _executionParams.message,
                _executionParams.extraData
            )
        // solhint-disable-next-line no-empty-blocks
        {
            // do nothing
        } catch (bytes memory reason) {
            // If the receive fails, report for monitoring.
            ILayerZeroEndpointV2Extended(ENDPOINT).lzReceiveAlert(
                _executionParams.origin,
                _executionParams.receiver,
                _executionParams.guid,
                _executionParams.gasLimit,
                value,
                _executionParams.message,
                _executionParams.extraData,
                reason
            );
        }
    }

    // --- Message Lib ---

    /**
     * @dev Assigns a job to the Executor and calculates the fee (used by message libraries).
     * @param _dstEid Destination EID.
     * @param _sender Address sending the job.
     * @param _calldataSize Size of calldata in bytes.
     * @param _options Additional options as bytes.
     * @return fee Fee calculated for the job.
     */
    function assignJob(
        uint32 _dstEid,
        address _sender,
        uint256 _calldataSize,
        bytes calldata _options
    ) external onlyRole(_MESSAGE_LIB_ROLE) onlyAcl(_sender) whenNotPaused returns (uint256 fee) {
        // Construct fee parameters for the fee library call
        IExecutorFeeLib.FeeParams memory params = IExecutorFeeLib.FeeParams(
            priceFeed,
            _dstEid,
            _sender,
            _calldataSize,
            defaultMultiplierBps
        );
        // Call external fee library (pluggable) for fee computation
        fee = IExecutorFeeLib(workerFeeLib).getFeeOnSend(params, dstConfig[_dstEid], _options);
    }

    /**
     * @dev Assigns a job for CmdLib (destination = localEidV2).
     * @param _sender Address sending the job.
     * @param _options Additional options as bytes.
     * @return fee Fee calculated for the job.
     */
    function assignJob(
        address _sender,
        bytes calldata _options
    ) external onlyRole(_MESSAGE_LIB_ROLE) onlyAcl(_sender) whenNotPaused returns (uint256 fee) {
        // Construct fee parameters for the fee library call
        IExecutorFeeLib.FeeParamsForRead memory params = IExecutorFeeLib.FeeParamsForRead(
            priceFeed,
            _sender,
            defaultMultiplierBps
        );
        // Call external fee library (pluggable) for fee computation
        fee = IExecutorFeeLib(workerFeeLib).getFeeOnSend(params, dstConfig[LOCAL_EID_V2], _options);
    }

    /**
     * @dev Returns the current execution state for a packet.
     * @param _packetHeader Encoded packet header.
     * @param _payloadHash Hash of the packet payload.
     * @return ExecutionState Current execution state of the packet.
     */
    function executable(
        bytes calldata _packetHeader,
        bytes32 _payloadHash
    ) public view returns (ExecutionState) {
        // Decode the receiver and origin details from the header
        address _receiver = _packetHeader.receiverB20();
        Origin memory _origin = Origin(
            _packetHeader.srcEid(),
            _packetHeader.sender(),
            _packetHeader.nonce()
        );

        // Query payload hash stored in the endpoint for the packet
        bytes32 payloadHash = ILayerZeroEndpointV2(ENDPOINT).inboundPayloadHash(
            _receiver,
            _origin.srcEid,
            _origin.sender,
            _origin.nonce
        );

        // 1. Already executed if the payload hash has been cleared and the nonce is less than or equal to lazyInboundNonce
        if (
            payloadHash == EMPTY_PAYLOAD_HASH &&
            _origin.nonce <=
            ILayerZeroEndpointV2(ENDPOINT).lazyInboundNonce(
                _receiver,
                _origin.srcEid,
                _origin.sender
            )
        ) {
            return ExecutionState.Executed;
        }

        // 2. Executable: if nonce has not been executed and has not been nilified and nonce is less than or equal to inboundNonce
        if (
            payloadHash != NIL_PAYLOAD_HASH &&
            payloadHash == _payloadHash &&
            _origin.nonce <=
            ILayerZeroEndpointV2(ENDPOINT).inboundNonce(_receiver, _origin.srcEid, _origin.sender)
        ) {
            return ExecutionState.Executable;
        }

        // 3. Pending but verified: only start active executable polling if payload hash is not empty nor nil
        if (payloadHash != EMPTY_PAYLOAD_HASH && payloadHash != NIL_PAYLOAD_HASH) {
            return ExecutionState.VerifiedButNotExecutable;
        }

        // 4. Not executable: catch-all
        return ExecutionState.NotExecutable;
    }

    /**
     * @dev Checks if a packet is in a verifiable state.
     * @param _packetHeader Encoded packet header bytes.
     * @param _payloadHash Keccak256 hash of packet payload.
     * @return state Current VerificationState of the packet.
     */
    function verifiable(
        bytes calldata _packetHeader,
        bytes32 _payloadHash
    ) public view returns (VerificationState) {
        address receiver = _packetHeader.receiverB20();

        Origin memory origin = Origin(
            _packetHeader.srcEid(),
            _packetHeader.sender(),
            _packetHeader.nonce()
        );

        // 1. Endpoint must support initialization (config present, etc)
        if (!_initializable(origin, receiver)) {
            return VerificationState.NotInitializable;
        }

        // 2. Endpoint verifiable (e.g. not already verified)
        if (!_endpointVerifiable(origin, receiver, _payloadHash)) {
            return VerificationState.Verified;
        }

        // 3. ULN verifiable (DVN or ULN, packet is verifiable)
        if (
            IReceiveUlnView(RECEIVE_ULN302).verifiable(
                IReceiveUlnView(RECEIVE_ULN302).getUlnConfig(receiver, origin.srcEid),
                keccak256(_packetHeader),
                _payloadHash
            )
        ) {
            return VerificationState.Verifiable;
        }

        // 4. Still verifying
        return VerificationState.Verifying;
    }

    // --- Only ACL ---

    /**
     * @dev Returns the fee for a given destination and calldata size (for msg sender).
     * @param _dstEid Destination EID.
     * @param _sender Address of message sender.
     * @param _calldataSize Calldata size.
     * @param _options Options encoded as bytes.
     * @return fee Quoted fee for the job.
     */
    function getFee(
        uint32 _dstEid,
        address _sender,
        uint256 _calldataSize,
        bytes calldata _options
    ) external view onlyAcl(_sender) whenNotPaused returns (uint256 fee) {
        // Construct fee parameters for the fee library call
        IExecutorFeeLib.FeeParams memory params = IExecutorFeeLib.FeeParams(
            priceFeed,
            _dstEid,
            _sender,
            _calldataSize,
            defaultMultiplierBps
        );
        // Call external fee library (pluggable) for fee computation
        fee = IExecutorFeeLib(workerFeeLib).getFee(params, dstConfig[_dstEid], _options);
    }

    /**
     * @dev Returns the fee for a read job (for CmdLib, msg sender).
     * @param _sender Address of message sender.
     * @param _options Options encoded as bytes.
     * @return fee Quoted fee for the job.
     */
    function getFee(
        address _sender,
        bytes calldata _options
    ) external view onlyAcl(_sender) whenNotPaused returns (uint256 fee) {
        // Construct fee parameters for the fee library call
        IExecutorFeeLib.FeeParamsForRead memory params = IExecutorFeeLib.FeeParamsForRead(
            priceFeed,
            _sender,
            defaultMultiplierBps
        );
        // Call external fee library (pluggable) for fee computation
        fee = IExecutorFeeLib(workerFeeLib).getFee(params, dstConfig[LOCAL_EID_V2], _options);
    }

    /// @dev Internal function to distribute native tokens to multiple recipients.
    /// @param _origin Origin information for the message context.
    /// @param _dstEid Destination endpoint ID.
    /// @param _oapp Target contract on remote chain.
    /// @param _nativeDropParams Array of receivers and amounts.
    /// @param _nativeDropGasLimit Gas limit for each transfer call.
    /// @return spent Total amount of native tokens sent.
    function _nativeDrop(
        Origin calldata _origin,
        uint32 _dstEid,
        address _oapp,
        NativeDropParams[] calldata _nativeDropParams,
        uint256 _nativeDropGasLimit
    ) internal returns (uint256 spent) {
        uint256 paramsLength = _nativeDropParams.length;
        bool[] memory success = new bool[](paramsLength);
        for (uint256 i = 0; i < paramsLength; ++i) {
            NativeDropParams memory param = _nativeDropParams[i];
            // slither-disable-next-line arbitrary-send-eth,low-level-calls,return-bomb
            (bool sent, ) = param.receiver.call{value: param.amount, gas: _nativeDropGasLimit}("");

            success[i] = sent;
            spent += param.amount;
        }
        emit NativeDropApplied(_origin, _dstEid, _oapp, _nativeDropParams, success);
    }

    /// @dev Checks whether the endpoint can be verified and the payload hash is not already stored.
    /// @param _origin Origin information for the message context.
    /// @param _receiver Address of the endpoint’s receiver contract.
    /// @param _payloadHash Keccak256 hash of the message payload.
    /// @return True if the endpoint is verifiable and hasn’t seen this payload before.
    function _endpointVerifiable(
        Origin memory _origin,
        address _receiver,
        bytes32 _payloadHash
    ) internal view returns (bool) {
        // check endpoint verifiable
        if (!_verifiable(_origin, _receiver, RECEIVE_ULN302, _payloadHash)) return false;

        // if endpoint.verifiable, also check if the payload hash matches
        // endpoint allows re-verify, check if this payload has already been verified
        if (
            ILayerZeroEndpointV2(ENDPOINT).inboundPayloadHash(
                _receiver,
                _origin.srcEid,
                _origin.sender,
                _origin.nonce
            ) == _payloadHash
        ) return false;

        return true;
    }

    /**
     * @dev Internal helper to verify library and endpoint readiness.
     * Checks if the receive library is valid for the receiver,
     * if the endpoint is verifiable for the origin and receiver,
     * and if the payload hash is non‐zero.
     * @param _origin Origin context for verification.
     * @param _receiver Receiver address on this chain.
     * @param _receiveLib Address of the ULN receive library to check.
     * @param _payloadHash Payload hash that must be non‐zero.
     * @return True if the receive library is registered, the endpoint is verifiable, and payloadHash ≠ 0.
     */
    function _verifiable(
        Origin memory _origin,
        address _receiver,
        address _receiveLib,
        bytes32 _payloadHash
    ) internal view returns (bool) {
        // Library must be a valid receive library for this endpoint
        if (
            !ILayerZeroEndpointV2(ENDPOINT).isValidReceiveLibrary(
                _receiver,
                _origin.srcEid,
                _receiveLib
            )
        ) return false;

        // Endpoint must report itself as verifiable for this origin
        if (!ILayerZeroEndpointV2(ENDPOINT).verifiable(_origin, _receiver)) return false;

        // Reject zero‐value hashes (not a real message)
        if (_payloadHash == EMPTY_PAYLOAD_HASH) return false;

        return true;
    }

    /**
     * @dev Checks if the endpoint supports initialization for a given origin and receiver.
     * @param _origin Origin context to query.
     * @param _receiver Address of the receiver contract to check.
     * @return True if the endpoint supports initialization for this origin and receiver.
     */
    function _initializable(Origin memory _origin, address _receiver) internal view returns (bool) {
        try ILayerZeroEndpointV2(ENDPOINT).initializable(_origin, _receiver) returns (
            bool initializable
        ) {
            return initializable;
        } catch {
            return false;
        }
    }
}
