// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC165} from "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import {IERC7575Share} from "../external/interfaces/IERC7575.sol";
import {IVaultContainer} from "./interfaces/IVaultContainer.sol";

/// @title Vault Container.
/// @notice Abstract contract for managing token Vaults and their assets.
/// @dev Implements the Vault management functionality with allowlisting and validation.
abstract contract VaultContainer is IVaultContainer, IERC7575Share, Ownable, ERC165 {
    // ============ State Variables ============

    /// @inheritdoc IERC7575Share
    mapping(address asset => address) public vault;

    /// @inheritdoc IVaultContainer
    mapping(address tokenVault => bool isValid) public isTokenVaultAllowed;

    /// @inheritdoc IVaultContainer
    mapping(bytes32 codeHash => bool isValid) public codeHashWhiteList;

    // ============ Modifiers ============

    /// @dev Ensures the caller is an allowed token Vault.
    modifier onlyTokenVault() {
        if (!isTokenVaultAllowed[msg.sender]) {
            revert TokenVaultNotAllowed();
        }
        _;
    }

    // ============ Admin Functions ============

    /// @inheritdoc IVaultContainer
    function addTokenVault(address tokenVault) public virtual override onlyOwner {
        // Validate the token Vault code hash.
        if (!codeHashWhiteList[tokenVault.codehash]) {
            revert CodeHashNotInWhiteList();
        }

        // Get and validate the underlying asset.
        address asset = _getAsset(tokenVault);
        if (asset == address(0)) {
            revert ETokenVaultNotInit();
        }

        // Check the existing Vault.
        if (vault[asset] != address(0)) {
            revert EHasTokenVaultForAsset();
        }

        // Register the token Vault.
        isTokenVaultAllowed[tokenVault] = true;
        vault[asset] = tokenVault;

        emit TokenVaultAdded(tokenVault);
    }

    /// @inheritdoc IVaultContainer
    function removeTokenVault(address tokenVault) public virtual override onlyOwner {
        // Validate whether the token Vault exists.
        if (!isTokenVaultAllowed[tokenVault]) {
            revert ENoTokenVault();
        }

        // Clean up the Vault mappings.
        address asset = _getAsset(tokenVault);
        delete vault[asset];
        delete isTokenVaultAllowed[tokenVault];

        emit TokenVaultRemoved(tokenVault);
    }

    /// @inheritdoc IVaultContainer
    function setCodeHash(bytes32 codeHash, bool isValid) external virtual override onlyOwner {
        // Prevent redundant updates.
        if (codeHashWhiteList[codeHash] == isValid) {
            revert EAlreadySetStatus();
        }

        // Update the allowlist status.
        codeHashWhiteList[codeHash] = isValid;

        emit CodeHashSet(codeHash, isValid);
    }

    // ============ View Functions ============

    /// @inheritdoc IVaultContainer
    function validateTokenVault(address addr) external view virtual override {
        if (!isTokenVaultAllowed[addr]) {
            revert TokenVaultNotAllowed();
        }
    }

    /// @inheritdoc ERC165
    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return
            type(IERC7575Share).interfaceId == interfaceId || super.supportsInterface(interfaceId);
    }

    // ============ Internal Functions ============

    /// @dev Gets the underlying asset address for a token Vault.
    /// @param tokenVault Token Vault's address.
    /// @return asset Underlying asset's address.
    function _getAsset(address tokenVault) internal view virtual returns (address asset);
}
