// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.24;

import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {IVotes} from "@openzeppelin/contracts/governance/utils/IVotes.sol";
import {IERC6372} from "@openzeppelin/contracts/interfaces/IERC6372.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {ERC20Votes} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ERC165} from "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import {Nonces} from "@openzeppelin/contracts/utils/Nonces.sol";
import {IRebaseERC20} from "./../common/interfaces/IRebaseERC20.sol";
import {ValueValidator} from "./../common/ValueValidator.sol";
import {IwmUSD} from "./interfaces/IwmUSD.sol";

/// @notice WMUSD is a wrapped, non-rebasing version of mUSD.
/// The token is designed for seamless integration into DeFi protocols, CEXes, etc.
abstract contract WMUSD is IwmUSD, ERC20Permit, ERC20Votes, ERC165, Ownable2Step, ValueValidator {
    using SafeERC20 for IERC20;

    // ============ State Variables ============

    /// @inheritdoc IwmUSD
    // slither-disable-next-line immutable-states
    address public mUSD;

    /// @inheritdoc IwmUSD
    address public yieldDistributor;

    // ============ Modifiers ============

    /// @dev Throws an error if the caller is not the authorized Yield Distributor.
    modifier onlyYieldDistributor() {
        if (msg.sender != yieldDistributor) {
            revert ENotYieldDistributor();
        }
        _;
    }

    /// @dev Ensures that the contract is in candy state (mUSD address is set).
    modifier ensureCandy() {
        if (mUSD == address(0)) {
            revert EContractIsEmpty();
        }
        _;
    }

    // ============ Constructor ============

    /// @dev Constructor for initializing the contract.
    /// @param name Token name.
    /// @param symbol Token symbol.
    /// @param owner Smart contract owner address.
    /// @param mUSD_ Rebase token's address.
    /// @param yieldDistributor_ Authorized yield distributor address.
    constructor(
        string memory name,
        string memory symbol,
        address owner,
        address mUSD_,
        address yieldDistributor_
    ) ERC20(name, symbol) ERC20Permit(name) Ownable(owner) notZeroAddress(yieldDistributor_) {
        mUSD = mUSD_;
        yieldDistributor = yieldDistributor_;
    }

    // ============ Core Functions ============

    /// @inheritdoc IwmUSD
    function wrap(uint256 mUSDAmount) external virtual override ensureCandy {
        // Transfer the requested amount of mUSD from the user.
        IERC20(mUSD).safeTransferFrom(msg.sender, address(this), mUSDAmount);

        // Mint wmUSD tokens for the user.
        _mint(msg.sender, mUSDAmount);

        // Emit an event to log the wrap operation.
        emit Wrapped(msg.sender, mUSDAmount);
    }

    /// @inheritdoc IwmUSD
    function unwrap(uint256 wmUSDAmount) external virtual override ensureCandy {
        // Convert wmUSD to mUSD.
        uint256 mUSDAmount = convertTomUSD(wmUSDAmount);

        // Burn wmUSD tokens for the user and emit the `Transfer` event.
        _burn(msg.sender, wmUSDAmount);

        // Transfer the requested amount of mUSD to the user.
        IERC20(mUSD).safeTransfer(msg.sender, mUSDAmount);

        // Emit an event to log the unwrap operation.
        emit Unwrapped(msg.sender, wmUSDAmount, mUSDAmount);
    }

    /// @inheritdoc IwmUSD
    function distributeYield(
        address beneficiary,
        uint256 shares
    ) external virtual override ensureCandy onlyYieldDistributor {
        // Check whether there are enough shares.
        if (shares > currentYieldShares()) {
            revert ETooManyShares();
        }

        // Convert the shares to the equivalent mUSD amount.
        uint256 mUSDAmount = IRebaseERC20(mUSD).convertToAssets(shares);

        // Transfer the requested amount of mUSD to the beneficiary.
        IERC20(mUSD).safeTransfer(beneficiary, mUSDAmount);

        // Emit event for tracking.
        emit YieldDistributed(beneficiary, shares, mUSDAmount);
    }

    /// @inheritdoc IwmUSD
    function setYieldDistributor(
        address newYieldDistributor
    ) external virtual override onlyOwner notZeroAddress(newYieldDistributor) {
        address oldYieldDistributor = yieldDistributor;
        yieldDistributor = newYieldDistributor;

        // Emit event for tracking.
        emit YieldDistributorChanged(oldYieldDistributor, newYieldDistributor);
    }

    // ============ View Functions ============

    /// @inheritdoc IwmUSD
    function convertTomUSD(
        uint256 wmUSDAmount
    ) public view virtual override ensureCandy returns (uint256 mUSDAmount) {
        // Get the actual mUSD balance of this contract.
        uint256 actualMUSDValue = IERC20(mUSD).balanceOf(address(this));
        uint256 lockedWMUSDValue = totalSupply();
        // Check if actual mUSD balance is less than mUSD wrapped value, i.e. share price is decreased.
        if (actualMUSDValue < lockedWMUSDValue) {
            // In unfavorable situation, 1 wmUSD is greater than 1 mUSD.

            // Calculate actual mUSD shares.
            uint256 shares = (wmUSDAmount * totalShares()) / lockedWMUSDValue;

            // Convert actual mUSD shares to the mUSD value.
            mUSDAmount = IRebaseERC20(mUSD).convertToAssets(shares);
        } else {
            // In regular case, 1 wmUSD is equal to 1 mUSD.
            mUSDAmount = wmUSDAmount;
        }
    }

    /// @inheritdoc IwmUSD
    function currentYield() external view virtual override ensureCandy returns (uint256) {
        uint256 actualMUSDValue = IERC20(mUSD).balanceOf(address(this));
        uint256 lockedWMUSDValue = totalSupply();
        // Note: User locked their mUSD tokens in the contract.
        // Shares' price is always increasing in the mUSD contract, along with the user's mUSD.
        // Yield is the difference between the increased mUSD and locked mUSD amounts.
        unchecked {
            return actualMUSDValue > lockedWMUSDValue ? actualMUSDValue - lockedWMUSDValue : 0;
        }
    }

    /// @inheritdoc IwmUSD
    function currentYieldShares() public view virtual override ensureCandy returns (uint256) {
        uint256 actualShares = totalShares();
        uint256 lockedShares = IRebaseERC20(mUSD).convertToShares(totalSupply());
        unchecked {
            return actualShares > lockedShares ? actualShares - lockedShares : 0;
        }
    }

    /// @inheritdoc ERC165
    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return
            interfaceId == type(IERC20).interfaceId ||
            interfaceId == type(IERC20Permit).interfaceId ||
            interfaceId == type(IERC6372).interfaceId ||
            interfaceId == type(IVotes).interfaceId ||
            super.supportsInterface(interfaceId);
    }

    /// @inheritdoc Nonces
    function nonces(
        address owner
    ) public view virtual override(ERC20Permit, Nonces) returns (uint256) {
        return super.nonces(owner);
    }

    /// @inheritdoc IwmUSD
    function totalShares() public view returns (uint256) {
        return IRebaseERC20(mUSD).sharesOf(address(this));
    }

    // ============ Internal Functions ============

    /// @inheritdoc ERC20
    function _update(
        address from,
        address to,
        uint256 value
    ) internal virtual override(ERC20, ERC20Votes) {
        super._update(from, to, value);
    }
}
