// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * Link to the original contract:
 * https://github.com/etherfi-protocol/smart-contracts/blob/master/src/interfaces/IWeETH.sol
 */

/// @title IweETH Interface
/// @dev Provides conversion functions between eETH and weETH tokens.
interface IweETH {
    /// @dev Calculates the amount of weETH tokens .for a given amount of eETH.
    /// @param _eETHAmount The amount of eETH to convert.
    /// @return The equivalent amount of weETH tokens.
    function getWeETHByeETH(uint256 _eETHAmount) external view returns (uint256);

    /// @dev Calculates the amount of eETH for a given amount of weETH tokens.
    /// @param _weETHAmount The amount of weETH to convert.
    /// @return The equivalent amount of eETH.
    function getEETHByWeETH(uint256 _weETHAmount) external view returns (uint256);
}
