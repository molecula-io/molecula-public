// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.23;

interface INitrogenTokenVault {
    // ============ Structs ============

    /// @dev Information about a deposit or redemption request.
    /// @param controller Controller's address.
    /// @param owner Owner's address.
    /// @param assets Assets amount.
    /// @param shares Shares amount.
    struct RequestInfo {
        address controller;
        address owner;
        uint256 assets;
        uint256 shares;
    }

    // ============ Events ============

    /// @dev Emitted when redemption requests are ready to be processed.
    /// @param requestIds Array of request IDs.
    /// @param values Array of corresponding values.
    event RedeemClaimable(uint256[] requestIds, uint256[] values);

    // ============ Core Functions ============

    /// @dev Follows the sequences:
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
