// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.23;

import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {IIssuer} from "./../interfaces/IIssuer.sol";
import {IOracleV2} from "./../interfaces/IOracleV2.sol";
import {IShare} from "./interfaces/IShare.sol";
import {Permit} from "./Permit.sol";
import {RebaseERC20V2} from "./RebaseERC20V2.sol";
import {ShareToken} from "./ShareToken.sol";

/// @title RebaseTokenV2.
/// @notice Contract for implementing the RebaseERC20V2 functionality.
/// @dev Extends RebaseERC20V2 with additional vault container and ownership features.
// slither-disable-next-line missing-inheritance
contract RebaseTokenV2 is IIssuer, Ownable2Step, Permit, RebaseERC20V2 {
    // ============ Constructor ============

    /// @dev Initializes the contract with specified parameters.
    /// @param oracle_ Oracle contract's address.
    /// @param initialOwner Smart contract owner's address.
    /// @param tokenName Token name.
    /// @param tokenSymbol Token symbol.
    /// @param tokenDecimals Token decimals.
    /// @param supplyManager_ SupplyManager's address. Might be equal to the zero address.
    constructor(
        address oracle_,
        address initialOwner,
        string memory tokenName,
        string memory tokenSymbol,
        uint8 tokenDecimals,
        address supplyManager_
    )
        RebaseERC20V2(tokenName, tokenSymbol, tokenDecimals)
        Ownable(initialOwner)
        EIP712(tokenName, "2.0.0")
        ShareToken(oracle_, supplyManager_)
    {}

    // ============ Core Functions ============

    /// @inheritdoc IIssuer
    function mint(
        address user,
        uint256 shares
    ) external virtual override onlySupplyManagerOrTokenVault {
        // Mint shares for the user.
        _mint(user, shares);
    }

    /// @inheritdoc IIssuer
    function burn(
        address user,
        uint256 shares
    ) external virtual override onlySupplyManagerOrTokenVault {
        // Burn the user's shares.
        _burn(user, shares);
    }

    // ============ Admin Functions ============

    /// @inheritdoc Ownable2Step
    function transferOwnership(address newOwner) public virtual override(Ownable, Ownable2Step) {
        // Initiate ownership transfer.
        super.transferOwnership(newOwner);
    }

    // ============ View Functions ============

    /// @inheritdoc IERC20
    function totalSupply() external view virtual override returns (uint256 totalPool) {
        totalPool = IOracleV2(oracle).getTotalPoolSupply();
    }

    /// @inheritdoc IShare
    function totalSharesSupply() external view virtual override returns (uint256 totalShares) {
        totalShares = IOracleV2(oracle).getTotalSharesSupply();
    }

    // ============ Internal Functions ============

    /// @inheritdoc Ownable2Step
    function _transferOwnership(address newOwner) internal virtual override(Ownable, Ownable2Step) {
        // Transfer ownership to the new owner.
        super._transferOwnership(newOwner);
    }

    /// @inheritdoc Permit
    function _onPermit(address owner, address spender, uint256 shares) internal virtual override {
        _approve(owner, spender, shares);
    }
}
