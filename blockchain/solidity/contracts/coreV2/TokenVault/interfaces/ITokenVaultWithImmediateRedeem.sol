// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.24;

/// @title ITokenVaultWithImmediateRedeem.
/// @dev Interface to extend the `ITokenVault` interface for redeeming shares immediately.
interface ITokenVaultWithImmediateRedeem {
    // ============ Core Functions ============

    /// @dev Redeem shares immediately. Follows the sequences:
    /// - Claims assets available to redeem.
    /// - Creates a new redemption operation request.
    /// - Fulfills the request.
    /// - Claims the redeemed assets.
    /// @param shares Amount of shares to redeem.
    /// @param receiver Receiver's address.
    /// @param owner Owner of shares.
    /// @return requestId Operation ID.
    function redeemImmediately(
        uint256 shares,
        address receiver,
        address owner
    ) external returns (uint256 requestId);
}
