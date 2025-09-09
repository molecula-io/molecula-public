// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import {IWrappedRebaseAsset} from "./interfaces/IWrappedRebaseAsset.sol";
import {WrappedRebaseAsset} from "./WrappedRebaseAsset.sol";

/// @title SuppliedWrappedRebaseAsset.
/// @notice Wrapper contract has two possible states:
/// - `supplied`: The `rebaseToken` address is set.
/// - `unsupplied`: The `rebaseToken` address is not set.
/// @dev This contract is initially in the `supplied` state and cannot be `unsupplied`.
abstract contract SuppliedWrappedRebaseAsset is WrappedRebaseAsset {
    // ============ State Variables ============

    /// @dev Rebase token's address.
    address internal immutable _REBASE_TOKEN;

    // ============ Constructor ============

    /// @dev Constructor for initializing the contract.
    /// @param rebaseToken_ Rebase token's address.
    constructor(address rebaseToken_) notZeroAddress(rebaseToken_) {
        _REBASE_TOKEN = rebaseToken_;
    }

    // ============ View Functions ============

    /// @inheritdoc IWrappedRebaseAsset
    function rebaseToken() public view virtual override returns (address) {
        return _REBASE_TOKEN;
    }
}
