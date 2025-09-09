// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.30;

/// @title IRedeemController.
/// @notice Interface for managing redeem controller operations.
/// @dev Defines events, errors, and core functions for the redeem controller.
interface IRedeemController {
    // ============ Events ============

    /// @dev Emitted when the request is redeemed by the controller.
    /// @param requestId Request ID.
    /// @param receiver Receiver's address.
    /// @param controller Controller's address.
    /// @param assets Amount of assets redeemed.
    event Redeem(
        uint256 indexed requestId,
        address indexed receiver,
        address indexed controller,
        uint256 assets
    );

    // ============ Errors ============

    /// @dev Error indicating that the request is not in the `Claimable` state.
    /// @param requestId Request ID.
    error ERedeemRequestNotClaimable(uint256 requestId);

    /// @dev Error indicating that the request has already been redeemed.
    /// @param requestId Request ID.
    error ERedeemRequestAlreadyRedeemed(uint256 requestId);

    // ============ Core Functions ============

    /// @dev Redemptions requests.
    /// @param requestIds Array of request IDs.
    /// @return shares Amount of shares redeemed.
    function redeem(uint256[] calldata requestIds) external returns (uint256 shares);
}
