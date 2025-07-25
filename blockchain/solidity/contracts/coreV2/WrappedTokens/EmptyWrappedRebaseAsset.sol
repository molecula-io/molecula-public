// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import {IIssuer} from "./../interfaces/IIssuer.sol";
import {IEmptyWrappedRebaseAsset} from "./interfaces/IEmptyWrappedRebaseAsset.sol";
import {IWrappedRebaseAsset} from "./interfaces/IWrappedRebaseAsset.sol";
import {WrappedRebaseAsset} from "./WrappedRebaseAsset.sol";

/// @title EmptyWrappedRebaseAsset
/// @notice Wrapper contract has two possible states:
/// - `candy`: The `rebaseToken` address is set.
/// - `empty`: The `rebaseToken` address is not set.
/// @dev This contract is initially in the `empty` state and can switch to `candy`.
abstract contract EmptyWrappedRebaseAsset is IEmptyWrappedRebaseAsset, IIssuer, WrappedRebaseAsset {
    // ============ State Variables ============

    /// @dev Rebase token's address.
    address internal _rebaseToken;

    /// @inheritdoc IEmptyWrappedRebaseAsset
    address public bridger;

    // ============ Modifiers ============

    /// @dev Ensures that the contract is in the `empty` state — the address of the rebase token is not set.
    modifier ensureEmpty() {
        if (_rebaseToken != address(0)) {
            revert EContractIsAlreadyCandy();
        }
        _;
    }

    /// @dev Ensures that the contract is in the `candy` state — the `rebaseToken` address is set.
    modifier ensureCandy() {
        if (_rebaseToken == address(0)) {
            revert EContractIsEmpty();
        }
        _;
    }

    // ============ Constructor ============

    /// @dev Constructor for initializing the contract.
    /// @param bridger_ Address authorized to mint and burn tokens during the empty state. Maybe be zero address.
    constructor(address bridger_) notZeroAddress(bridger_) {
        bridger = bridger_;
    }

    // ============ Anybody's Functions ============

    /// @inheritdoc IWrappedRebaseAsset
    function wrap(uint256 rebaseAssets) public virtual override ensureCandy {
        super.wrap(rebaseAssets);
    }

    /// @inheritdoc IWrappedRebaseAsset
    function unwrap(uint256 wrappedRebaseAssets) public virtual override ensureCandy {
        super.unwrap(wrappedRebaseAssets);
    }

    // ============ Distributor Functions ============

    /// @inheritdoc IWrappedRebaseAsset
    function distributeYield(
        address beneficiary,
        uint256 shares
    ) public virtual override ensureCandy {
        super.distributeYield(beneficiary, shares);
    }

    // ============ Bridger Functions ============

    /// @inheritdoc IIssuer
    function mint(
        address user,
        uint256 wrappedRebaseAssets
    ) external virtual override ensureEmpty only(bridger) {
        _mint(user, wrappedRebaseAssets);
    }

    /// @inheritdoc IIssuer
    function burn(
        address user,
        uint256 wrappedRebaseAssets
    ) external virtual override ensureEmpty only(bridger) {
        _burn(user, wrappedRebaseAssets);
    }

    /// @inheritdoc IEmptyWrappedRebaseAsset
    function turnToCandy(
        address rebaseToken_
    ) external virtual override ensureEmpty only(bridger) notZeroAddress(rebaseToken_) {
        // Remove the bridger
        _setBridger(address(0));

        // Set the address of rebase token
        _rebaseToken = rebaseToken_;

        // Emit an event to log the turn to candy operation.
        emit TurnedToCandy(rebaseToken_);
    }

    // ============ Owner Functions ============

    /// @inheritdoc IEmptyWrappedRebaseAsset
    function setBridger(
        address bridger_
    ) external virtual override ensureEmpty onlyOwner notZeroAddress(bridger_) {
        _setBridger(bridger_);
    }

    // ============ View Functions ============

    /// @inheritdoc IWrappedRebaseAsset
    function convertToRebaseAssets(
        uint256 wrappedRebaseAssets
    ) public view virtual override ensureCandy returns (uint256 rebaseAssets) {
        return super.convertToRebaseAssets(wrappedRebaseAssets);
    }

    /// @inheritdoc IWrappedRebaseAsset
    function currentYield() public view virtual override ensureCandy returns (uint256) {
        return super.currentYield();
    }

    /// @inheritdoc IWrappedRebaseAsset
    function rebaseToken() public view virtual override returns (address) {
        return _rebaseToken;
    }

    // ============ Internal Functions ============

    /// @dev Sets a new bridger address
    /// @param bridger_ The address of the new bridger
    function _setBridger(address bridger_) internal virtual {
        address oldBridger = bridger;
        bridger = bridger_;
        emit BridgerSet(oldBridger, bridger_);
    }
}
