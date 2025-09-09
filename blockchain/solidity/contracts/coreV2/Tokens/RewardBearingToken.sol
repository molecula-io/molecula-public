// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {IIssuer} from "./../interfaces/IIssuer.sol";
import {IOracleV2} from "./../interfaces/IOracleV2.sol";
import {IShare} from "./interfaces/IShare.sol";
import {Permit} from "./Permit.sol";
import {ShareToken} from "./ShareToken.sol";

/// @title RewardBearingToken Contract.
/// @notice A token contract that represents shares in an underlying asset pool with reward-bearing capabilities
/// @dev Implements ERC20 standard with additional functionality for reward distribution and ownership management
// Next line in order to suspend warning: RewardBearingToken should inherit from contracts/common/interfaces/IRebaseERC20.sol
// slither-disable-next-line missing-inheritance
contract RewardBearingToken is IIssuer, ERC20, Ownable2Step, Permit, ShareToken {
    // ============ Constructor ============

    /// @dev Initializes the `RewardBearingToken` contract.
    /// @param name_ Token's name.
    /// @param symbol_ Token's symbol.
    /// @param initialOwner Initial owner's address.
    /// @param oracle_ Oracle contract's address.
    /// @param supplyManager Supply manager contract's address.
    constructor(
        string memory name_,
        string memory symbol_,
        address initialOwner,
        address oracle_,
        address supplyManager
    )
        ERC20(name_, symbol_)
        EIP712(name_, "2.0.0")
        Ownable(initialOwner)
        ShareToken(oracle_, supplyManager)
    {}

    // ============ Admin Functions ============

    /// @inheritdoc IIssuer
    function mint(
        address user,
        uint256 value
    ) external virtual override onlySupplyManagerOrTokenVault {
        _mint(user, value);
    }

    /// @inheritdoc IIssuer
    function burn(
        address user,
        uint256 value
    ) external virtual override onlySupplyManagerOrTokenVault {
        _burn(user, value);
    }

    /// @inheritdoc Ownable2Step
    function transferOwnership(address newOwner) public virtual override(Ownable, Ownable2Step) {
        // Initiate ownership transfer.
        super.transferOwnership(newOwner);
    }

    // ============ View Functions ============

    /// @inheritdoc IShare
    function sharesOf(address user) external view virtual override returns (uint256 shares) {
        return balanceOf(user);
    }

    /// @inheritdoc IShare
    function totalSharesSupply() external view virtual override returns (uint256 totalShares) {
        return totalSupply();
    }

    /// @inheritdoc ERC20
    function totalSupply() public view virtual override returns (uint256) {
        return IOracleV2(oracle).getTotalSharesSupply();
    }

    /// @inheritdoc IShare
    function localTotalShares() external view virtual override returns (uint256) {
        return super.totalSupply();
    }

    // ============ Internal Functions ============

    /// @inheritdoc Ownable2Step
    function _transferOwnership(address newOwner) internal virtual override(Ownable, Ownable2Step) {
        // Transfer ownership to the new owner.
        super._transferOwnership(newOwner);
    }

    /// @inheritdoc Permit
    function _onPermit(address owner, address spender, uint256 value) internal virtual override {
        _approve(owner, spender, value);
    }
}
