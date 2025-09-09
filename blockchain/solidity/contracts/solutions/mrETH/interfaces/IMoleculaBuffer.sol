// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.30;

/// @title Molecula Buffer Pool Interface.
/// @notice Defines the functions required for interacting with the Molecula Buffer Pool.
interface IMoleculaBuffer {
    /// @dev Error indicating invalid token provided.
    error EInvalidToken();

    /**
     * @dev Supplies WETH to the Molecula Buffer.
     * @param token Deposit token's address.
     * @param amount Amount to deposit.
     * @param receiver LP token receiver's address.
     */
    function supply(address token, uint256 amount, address receiver) external;

    /**
     * @dev Withdraws WETH from the Molecula Buffer.
     * @param token Deposit token's address.
     * @param amount Amount to withdraw.
     * @param receiver LP token receiver's address.
     */
    function withdraw(address token, uint256 amount, address receiver) external;
}
