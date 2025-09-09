// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.30;

/// @title Strategy Library Interface.
/// @notice Defines the functions for converting token balances into ETH.
interface IStrategyLib {
    /**
     * @dev Gets the withdrawable ETH balance.
     * @param tokenBalance Balance of the reward-bearing token.
     * @return uint256 Withdrawable ETH balance.
     */
    function getEthBalance(uint256 tokenBalance) external view returns (uint256);
}
