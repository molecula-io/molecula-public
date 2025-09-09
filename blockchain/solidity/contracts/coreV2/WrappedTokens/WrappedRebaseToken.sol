// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ValueValidator} from "./../../common/ValueValidator.sol";
import {Permit} from "./../Tokens/Permit.sol";
import {RebaseERC20V2} from "./../Tokens/RebaseERC20V2.sol";
import {IWrappedRebaseToken} from "./interfaces/IWrappedRebaseToken.sol";

/// @title WrappedRebaseToken.
abstract contract WrappedRebaseToken is IWrappedRebaseToken, ERC20, Permit, ValueValidator {
    using SafeERC20 for IERC20;

    // ============ Immutable Variables ============

    /// @dev Rebase token contract's address.
    address internal immutable _REBASE_TOKEN;

    // ============ Constructor ============

    /// @dev Initializes the `RewardBearingToken` contract.
    /// @param rebaseToken_ Rebase token's address.
    constructor(address rebaseToken_) notZeroAddress(rebaseToken_) {
        _REBASE_TOKEN = rebaseToken_;
    }

    // ============ Core functions ============

    /// @inheritdoc IWrappedRebaseToken
    function wrap(uint256 rebaseAssets) external virtual override {
        // Transfer the requested amount of rebase token assets from the user.
        IERC20(_REBASE_TOKEN).safeTransferFrom(msg.sender, address(this), rebaseAssets);

        // Convert assets to shares.
        uint256 shares = RebaseERC20V2(_REBASE_TOKEN).convertToShares(rebaseAssets);

        // Mint wrapped rebase tokens for the user and emit a `Transfer` event.
        _mint(msg.sender, shares);
    }

    /// @inheritdoc IWrappedRebaseToken
    function unwrap(uint256 shares) external virtual override {
        // Burn wrapped rebase tokens for the user and emit a `Transfer` event.
        _burn(msg.sender, shares);

        // Convert shares to assets.
        uint256 rebaseAssets = RebaseERC20V2(_REBASE_TOKEN).convertToAssets(shares);

        // Transfer the requested amount of rebase token assets to the user.
        IERC20(_REBASE_TOKEN).safeTransfer(msg.sender, rebaseAssets);
    }

    // ============ View functions ============

    /// @inheritdoc IWrappedRebaseToken
    function rebaseToken() external view virtual override returns (address) {
        return _REBASE_TOKEN;
    }

    // ============ Internal Functions ============

    /// @inheritdoc Permit
    function _onPermit(address owner, address spender, uint256 value) internal virtual override {
        _approve(owner, spender, value);
    }
}
