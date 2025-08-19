// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import {IIssuer} from "./../interfaces/IIssuer.sol";
import {IUnsuppliedWrappedRebaseAsset} from "./interfaces/IUnsuppliedWrappedRebaseAsset.sol";
import {IWrappedRebaseAsset} from "./interfaces/IWrappedRebaseAsset.sol";
import {WrappedRebaseAsset} from "./WrappedRebaseAsset.sol";

/// @title UnsuppliedWrappedRebaseAsset
/// @notice Wrapper contract has two possible states:
/// - `supplied`: The `rebaseToken` address is set.
/// - `unsupplied`: The `rebaseToken` address is not set.
/// @dev This contract is initially in the `unsupplied` state and can switch to `supplied`.
abstract contract UnsuppliedWrappedRebaseAsset is
    IUnsuppliedWrappedRebaseAsset,
    IIssuer,
    WrappedRebaseAsset
{
    // ============ State Variables ============

    /// @dev Rebase token's address.
    address internal _rebaseToken;

    /// @inheritdoc IUnsuppliedWrappedRebaseAsset
    address public bridger;

    // ============ Modifiers ============

    /// @dev Ensures that the contract is in the `unsupplied` state — the address of the rebase token is not set.
    modifier ensureUnsupplied() {
        if (_rebaseToken != address(0)) {
            revert EContractIsAlreadySupplied();
        }
        _;
    }

    /// @dev Ensures that the contract is in the `supplied` state — the `rebaseToken` address is set.
    modifier ensureSupplied() {
        if (_rebaseToken == address(0)) {
            revert EContractIsEmpty();
        }
        _;
    }

    // ============ Constructor ============

    /// @dev Constructor for initializing the contract.
    /// @param bridger_ Address authorized to mint and burn tokens during the `unsupplied` state. Maybe be zero address.
    constructor(address bridger_) notZeroAddress(bridger_) {
        bridger = bridger_;
    }

    // ============ Anybody's Functions ============

    /// @inheritdoc IWrappedRebaseAsset
    function wrap(uint256 rebaseAssets) public virtual override ensureSupplied {
        super.wrap(rebaseAssets);
    }

    /// @inheritdoc IWrappedRebaseAsset
    function unwrap(uint256 wrappedRebaseAssets) public virtual override ensureSupplied {
        super.unwrap(wrappedRebaseAssets);
    }

    // ============ Distributor Functions ============

    /// @inheritdoc IWrappedRebaseAsset
    function distributeYield(
        address beneficiary,
        uint256 shares
    ) public virtual override ensureSupplied {
        super.distributeYield(beneficiary, shares);
    }

    // ============ Bridger Functions ============

    /// @inheritdoc IIssuer
    function mint(
        address user,
        uint256 wrappedRebaseAssets
    ) external virtual override ensureUnsupplied only(bridger) {
        _mint(user, wrappedRebaseAssets);
    }

    /// @inheritdoc IIssuer
    function burn(
        address user,
        uint256 wrappedRebaseAssets
    ) external virtual override ensureUnsupplied only(bridger) {
        _burn(user, wrappedRebaseAssets);
    }

    /// @inheritdoc IUnsuppliedWrappedRebaseAsset
    function turnToSupplied(
        address rebaseToken_
    ) external virtual override ensureUnsupplied only(bridger) notZeroAddress(rebaseToken_) {
        // Remove the bridger
        _setBridger(address(0));

        // Set the address of rebase token
        _rebaseToken = rebaseToken_;

        // Emit an event to log the turn to supplied operation.
        emit TurnedToSupplied(rebaseToken_);
    }

    // ============ Owner Functions ============

    /// @inheritdoc IUnsuppliedWrappedRebaseAsset
    function setBridger(
        address bridger_
    ) external virtual override ensureUnsupplied onlyOwner notZeroAddress(bridger_) {
        _setBridger(bridger_);
    }

    // ============ View Functions ============

    /// @inheritdoc IWrappedRebaseAsset
    function convertToRebaseAssets(
        uint256 wrappedRebaseAssets
    ) public view virtual override ensureSupplied returns (uint256 rebaseAssets) {
        return super.convertToRebaseAssets(wrappedRebaseAssets);
    }

    /// @inheritdoc IWrappedRebaseAsset
    function currentYield() public view virtual override ensureSupplied returns (uint256) {
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
