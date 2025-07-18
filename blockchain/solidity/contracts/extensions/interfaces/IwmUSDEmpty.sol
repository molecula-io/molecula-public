// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @title IwmUSDEmpty Interface
/// @dev Interface for the empty state of wrapped mUSD (wmUSD) token
/// @dev This interface defines the functions and events for initializing the wmUSD contract
interface IwmUSDEmpty {
    // ============ Events ============

    /// @dev Emitted when the contract is turned into candy state
    /// @param mUSD The address of the mUSD token used for initialization
    event TurnedToCandy(address indexed mUSD);

    /// @dev Emitted when the bridger address is changed
    /// @param oldBridger The previous bridger address
    /// @param newBridger The new bridger address
    event BridgerSet(address indexed oldBridger, address indexed newBridger);

    // ============ Errors ============

    /// @dev Error thrown when attempting to call empty function while it's already in candy state
    error EContractIsAlreadyCandy();

    // ============ Core Functions ============

    /// @dev Sets a new bridger address
    /// @param bridger_ The address of the new bridger
    function setBridger(address bridger_) external;

    /// @dev Converts the contract to candy state with specified mUSD token
    /// @param mUSD_ The address of the mUSD token
    function turnToCandy(address mUSD_) external;

    // ============ View Functions ============

    /// @dev Returns the current bridger address
    /// @return The address of the current bridger
    function bridger() external view returns (address);
}
