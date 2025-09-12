// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

interface INitrogenTokenVault {
    // ============ Structs ============

    /// @dev Information about a deposit or redemption request.
    /// @param controller Controller's address.
    /// @param owner Owner's address.
    /// @param shares Shares amount.
    struct RequestInfo {
        address controller;
        address owner;
        uint256 shares;
    }

    // ============ Events ============

    /// @dev Emitted when redemption requests are ready to be processed.
    /// @param requestIds Array of request IDs.
    /// @param values Array of corresponding values.
    event RedeemClaimable(uint256[] requestIds, uint256[] values);
}
