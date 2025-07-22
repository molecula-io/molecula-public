// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.24;

interface IRebaseTokenOwner {
    // ============ Events ============

    /// @dev Event emitted when a user requests a deposit.
    /// @param to User's address.
    /// @param shares Shares amount.
    event RequestDeposit(address indexed to, uint256 indexed shares);

    /// @dev Event emitted when a user requests a redemption.
    /// @param to User's address.
    /// @param shares Shares' amount.
    event RequestRedeem(address indexed to, uint256 indexed shares);

    /// @dev Event emitted when distributing yield.
    /// @param users Array of user addresses.
    /// @param shares Array of shares.
    event DistributeYield(address[] users, uint256[] shares);

    // ============ Errors ============

    /// @dev Error: Provided forbidden selector.
    error EBadSelector();

    // ============ Core Functions ============

    /// @dev Call a Rebase Token's function.
    /// @param data Function payload.
    /// @return result Data that was returned by the function call.
    function callRebaseToken(bytes memory data) external returns (bytes memory result);

    /// @dev Adds shares to the user.
    /// @param users User's address.
    /// @param shares Amount of shares to add.
    function distribute(address[] memory users, uint256[] memory shares) external;
}
