// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title LayerZero ULN Verification and Execution State Enums & View Interface
/// @dev These enums and interface are used for verifying and tracking LayerZero Ultra Light Node packet states.

/**
 * @dev Represents the verification status of a LayerZero packet.
 * - Verifying:     Packet is still undergoing DVN verification.
 * - Verifiable:    Packet is ready to be committed after successful DVN verification.
 * - Verified:      Packet has been verified.
 * - NotInitializable:  Packet cannot be initialized for verification due to config/state.
 */
enum VerificationState {
    Verifying,
    Verifiable,
    Verified,
    NotInitializable
}

/**
 * @dev Represents the execution status of a LayerZero packet.
 * - NotExecutable:               Packet cannot be executed (waiting for verification).
 * - VerifiedButNotExecutable:    Packet has been verified but is not yet executable (active polling).
 * - Executable:                  Packet is executable (can be processed by the executor).
 * - Executed:                    Packet has already been executed.
 */
enum ExecutionState {
    NotExecutable,
    VerifiedButNotExecutable,
    Executable,
    Executed
}

/**
 * @dev Interface for reading Ultra Light Node (ULN) verification config and status.
 */
interface IReceiveUlnView {
    /**
     * @dev ULN DVN configuration for a given remote chain and OApp.
     * @param confirmations         Number of block confirmations required for DVN.
     * @param requiredDVNCount      Number of required DVNs (0 = default, special NIL_DVN_COUNT disables).
     * @param optionalDVNCount      Number of optional DVNs (0 = default, special NIL_DVN_COUNT disables).
     * @param optionalDVNThreshold  Minimum number of optional DVN confirmations required.
     * @param requiredDVNs          List of required DVN addresses (sorted, unique, may overlap with optional).
     * @param optionalDVNs          List of optional DVN addresses (sorted, unique, may overlap with required).
     */
    struct UlnConfig {
        uint64 confirmations;
        uint8 requiredDVNCount;
        uint8 optionalDVNCount;
        uint8 optionalDVNThreshold;
        address[] requiredDVNs;
        address[] optionalDVNs;
    }

    /**
     * @dev Checks if a packet is verifiable given its ULN config, header hash, and payload hash.
     * @param _config      ULN configuration to check against.
     * @param _headerHash  keccak256 hash of the packet header.
     * @param _payloadHash keccak256 hash of the packet payload.
     * @return True if the packet is currently verifiable.
     */
    function verifiable(
        UlnConfig memory _config,
        bytes32 _headerHash,
        bytes32 _payloadHash
    ) external view returns (bool);

    /**
     * @dev Returns the current ULN configuration for a given OApp and remote EID.
     * @param _oapp       Address of the OApp (on this chain).
     * @param _remoteEid  Remote LayerZero endpoint ID.
     * @return rtnConfig  Current ULN config for this OApp and remote endpoint.
     */
    function getUlnConfig(
        address _oapp,
        uint32 _remoteEid
    ) external view returns (UlnConfig memory rtnConfig);
}
