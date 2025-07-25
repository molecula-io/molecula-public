// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ERC165} from "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import {ValueValidator} from "./../../common/ValueValidator.sol";
import {IShare} from "../Tokens/interfaces/IShare.sol";
import {IWrappedRebaseAsset} from "./interfaces/IWrappedRebaseAsset.sol";

/// @title WrappedRebaseAsset
abstract contract WrappedRebaseAsset is
    IWrappedRebaseAsset,
    ERC20,
    Ownable2Step,
    ERC165,
    ValueValidator
{
    using SafeERC20 for IERC20;

    // ============ State Variables ============

    /// @inheritdoc IWrappedRebaseAsset
    address public yieldDistributor;

    // ============ Modifiers ============

    /// @dev Throws an error if the caller is not an authorized Yield Distributor.
    modifier onlyYieldDistributor() {
        if (msg.sender != yieldDistributor) {
            revert ENotYieldDistributor();
        }
        _;
    }

    // ============ Constructor ============

    /// @dev Constructor for initializing the contract.
    /// @param yieldDistributor_ Authorized Yield Distributor's address.
    constructor(address yieldDistributor_) notZeroAddress(yieldDistributor_) {
        yieldDistributor = yieldDistributor_;
    }

    // ============ Core Functions ============

    /// @inheritdoc IWrappedRebaseAsset
    function wrap(uint256 rebaseAssets) public virtual override {
        // Transfer the requested amount of rebase tokens from the user.
        IERC20(rebaseToken()).safeTransferFrom(msg.sender, address(this), rebaseAssets);

        // Mint wrapped rebase tokens for the user.
        _mint(msg.sender, rebaseAssets);

        // Emit an event to log the wrap operation.
        emit Wrapped(msg.sender, rebaseAssets);
    }

    /// @inheritdoc IWrappedRebaseAsset
    function unwrap(uint256 wrappedRebaseAssets) public virtual override {
        // Convert wrapped rebase tokens to rebase tokens.
        uint256 rebaseAssets = convertToRebaseAssets(wrappedRebaseAssets);

        // Burn wrapped rebase tokens for the user and emit a `Transfer` event.
        _burn(msg.sender, wrappedRebaseAssets);

        // Transfer the requested amount of `rebaseToken` to the user.
        IERC20(rebaseToken()).safeTransfer(msg.sender, rebaseAssets);

        // Emit an event to log the unwrap operation.
        emit Unwrapped(msg.sender, wrappedRebaseAssets, rebaseAssets);
    }

    /// @inheritdoc IWrappedRebaseAsset
    function distributeYield(
        address beneficiary,
        uint256 shares
    ) public virtual override onlyYieldDistributor {
        // Check whether there are enough shares.
        if (shares > currentYieldShares()) {
            revert ETooManyShares();
        }

        // Get the rebase token's address.
        address rebaseTokenAddress = rebaseToken();

        // Convert the shares to the equivalent `rebaseToken` amount.
        uint256 rebaseAssets = IShare(rebaseTokenAddress).convertToAssets(shares);

        // Transfer the requested amount of `rebaseToken` to the beneficiary.
        IERC20(rebaseTokenAddress).safeTransfer(beneficiary, rebaseAssets);

        // Emit an event for tracking.
        emit YieldDistributed(beneficiary, shares, rebaseAssets);
    }

    /// @inheritdoc IWrappedRebaseAsset
    function setYieldDistributor(
        address newYieldDistributor
    ) external virtual override onlyOwner notZeroAddress(newYieldDistributor) {
        address oldYieldDistributor = yieldDistributor;
        yieldDistributor = newYieldDistributor;

        // Emit an event for tracking.
        emit YieldDistributorChanged(oldYieldDistributor, newYieldDistributor);
    }

    // ============ View Functions ============

    /// @inheritdoc IWrappedRebaseAsset
    function convertToRebaseAssets(
        uint256 wrappedRebaseAssets
    ) public view virtual override returns (uint256 rebaseAssets) {
        // Get the rebase token's address.
        address rebaseTokenAddress = rebaseToken();

        // Get the `rebaseToken` balance of this contract.
        uint256 actualRebaseAssets = IERC20(rebaseTokenAddress).balanceOf(address(this));
        uint256 lockedWrappedRebaseAssets = totalSupply();
        // Check if the `rebaseToken` balance is less than `rebaseToken` wrapped value, i.e. share price is decreased.
        if (actualRebaseAssets < lockedWrappedRebaseAssets) {
            // In unfavorable situation, one wrapped rebase asset is greater than one rebase asset.

            // Calculate rebaseToken shares.
            uint256 shares = (wrappedRebaseAssets * totalShares()) / lockedWrappedRebaseAssets;

            // Convert `rebaseToken` shares to the `rebaseToken` value.
            rebaseAssets = IShare(rebaseTokenAddress).convertToAssets(shares);
        } else {
            // Typically, one wrapped rebase asset is equal to one `rebaseToken`.
            rebaseAssets = wrappedRebaseAssets;
        }
    }

    /// @inheritdoc IWrappedRebaseAsset
    function currentYield() public view virtual override returns (uint256) {
        uint256 actualRebaseAssets = IERC20(rebaseToken()).balanceOf(address(this));
        uint256 lockedWrappedRebaseAssets = totalSupply();
        // Note: User locked their rebase tokens tokens in the contract.
        // Shares' price is always increasing in the rebase token contract, along with the user's rebase token.
        // Yield is the difference between the increased rebase token and locked rebase token amounts.
        unchecked {
            return
                actualRebaseAssets > lockedWrappedRebaseAssets
                    ? actualRebaseAssets - lockedWrappedRebaseAssets
                    : 0;
        }
    }

    /// @inheritdoc IWrappedRebaseAsset
    function currentYieldShares() public view virtual override returns (uint256) {
        uint256 actualShares = totalShares();
        uint256 lockedShares = IShare(rebaseToken()).convertToShares(totalSupply());
        unchecked {
            return actualShares > lockedShares ? actualShares - lockedShares : 0;
        }
    }

    /// @inheritdoc ERC165
    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return interfaceId == type(IERC20).interfaceId || super.supportsInterface(interfaceId);
    }

    /// @inheritdoc IWrappedRebaseAsset
    function totalShares() public view virtual override returns (uint256) {
        return IShare(rebaseToken()).sharesOf(address(this));
    }

    /// @inheritdoc IWrappedRebaseAsset
    function rebaseToken() public view virtual override returns (address);
}
