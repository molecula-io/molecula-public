// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @title IUnsuppliedWrappedRebaseAsset Interface.
interface IUnsuppliedWrappedRebaseAsset {
    // ============ Events ============

    /// @dev Emitted when the contract is switched into the `supplied` state.
    /// @param rebaseToken Address of the rebase token used for initialization.
    event TurnedToSupplied(address indexed rebaseToken);

    /// @dev Emitted when the bridger's address is changed.
    /// @param oldBridger Previous bridger's address.
    /// @param newBridger New bridger's address
    event BridgerSet(address indexed oldBridger, address indexed newBridger);

    // ============ Errors ============

    /// @dev Throws an error if the address of the rebase token contract is not set.
    error EContractIsEmpty();

    /// @dev Error thrown when attempting to call an `unsupplied` function while already being in the `supplied` state.
    error EContractIsAlreadySupplied();

    // ============ Core Functions ============

    /// @dev Sets a new bridger's address.
    /// @param bridger_ New bridger's address.
    function setBridger(address bridger_) external;

    /// @dev Switches the contract to the `supplied` state with specified rebase token.
    /// @param rebaseToken_ Address of the rebase token.
    function turnToSupplied(address rebaseToken_) external;

    // ============ View Functions ============

    /// @dev Returns the current bridger's address.
    /// @return Current bridger's address.
    function bridger() external view returns (address);
}
