// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @title IOracleV2.
/// @notice Interface for managing oracle operations.
/// @dev Defines core functions for supply and conversion operations.
interface IOracleV2 {
    // ============ View Functions ============

    /// @dev Returns the total pool supply value.
    /// @return pool Total pool supply value.
    function getTotalPoolSupply() external view returns (uint256 pool);

    /// @dev Returns the total shares supply value.
    /// @return shares Total shares supply value.
    function getTotalSharesSupply() external view returns (uint256 shares);

    /// @dev Returns both the total pool and shares supply values.
    /// @return pool Total pool supply value.
    /// @return shares Total shares supply value.
    function getTotalSupply() external view returns (uint256 pool, uint256 shares);

    /// @dev Converts assets to shares.
    /// @param assets Amount of assets to convert.
    /// @return shares Converted amount of shares.
    function convertToShares(uint256 assets) external view returns (uint256 shares);

    /// @dev Converts shares to assets.
    /// @param shares Amount of shares to convert.
    /// @return assets Converted amount of assets.
    function convertToAssets(uint256 shares) external view returns (uint256 assets);
}
