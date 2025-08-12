// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.24;

/// @title IWrappedRebaseToken
interface IWrappedRebaseToken {
    /// @dev Convert rebase assets to shares.
    /// @param rebaseAssets Rebase assets.
    function wrap(uint256 rebaseAssets) external;

    /// @dev Convert shares to rebase assets.
    /// @param shares Share amount.
    function unwrap(uint256 shares) external;

    /// @dev Returns the rebase token's address.
    /// @return Rebase token's address.
    function rebaseToken() external view returns (address);
}
