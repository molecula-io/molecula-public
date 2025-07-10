// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.23;

/// @title IIssuer.
/// @notice Interface for token minting and burning operations.
/// @dev Defines core functions for managing token supply.
interface IIssuer {
    // ============ Core Functions ============

    /// @dev Mints new tokens for the specified user.
    /// @param user Address of the user to mint tokens for.
    /// @param amount Amount of tokens to mint.
    function mint(address user, uint256 amount) external;

    /// @dev Burns tokens from the specified user.
    /// @param user Address of the user to burn tokens from.
    /// @param amount Amount of tokens to burn.
    function burn(address user, uint256 amount) external;
}
