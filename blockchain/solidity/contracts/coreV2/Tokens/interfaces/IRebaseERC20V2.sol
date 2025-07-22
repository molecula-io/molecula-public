// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.24;

/// @title IRebaseERC20V2.
/// @notice Interface for managing token shares and conversions.
/// @dev Defines core functions for share-based token operations.
interface IRebaseERC20V2 {
    // ============ Events ============

    /// @dev Emitted when shares are transferred between accounts.
    /// @param from Tokens owner's address.
    /// @param to Tokens recipient's address.
    /// @param shares Shares amount to transfer.
    event TransferShares(address indexed from, address indexed to, uint256 indexed shares);
}
