// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @title IVaultContainer.
/// @notice Interface for managing token vaults and their validation.
/// @dev Defines core functions for Vault container operations.
interface IVaultContainer {
    // ============ Errors ============

    /// @dev Thrown when the token Vault is not initialized.
    error ETokenVaultNotInit();

    /// @dev Thrown when no token Vault exists.
    error ENoTokenVault();

    /// @dev Thrown when the token Vault already exists for the asset.
    error EHasTokenVaultForAsset();

    /// @dev Thrown when the caller is not allowed.
    error TokenVaultNotAllowed();

    /// @dev Thrown when the status is already set.
    error EAlreadySetStatus();

    /// @dev Thrown when token Vault's code hash is not in allowlist.
    error CodeHashNotInWhiteList();

    // ============ Events ============

    /// @dev Emitted when a new token Vault is added.
    /// @param tokenVault Address of the added token Vault.
    event TokenVaultAdded(address indexed tokenVault);

    /// @dev Emitted when a token Vault is removed.
    /// @param tokenVault Address of the removed token Vault.
    event TokenVaultRemoved(address indexed tokenVault);

    /// @dev Emitted when the allowlist status of the code hash is updated.
    /// @param codeHash Hash of the code whose status was updated.
    /// @param isValid New allowlist status of the code hash.
    event CodeHashSet(bytes32 indexed codeHash, bool indexed isValid);

    // ============ Admin Functions ============

    /// @dev Adds a new token Vault.
    /// @param tokenVault Address of the token Vault to add.
    function addTokenVault(address tokenVault) external;

    /// @dev Removes a token Vault.
    /// @param tokenVault Address of the token Vault to remove.
    function removeTokenVault(address tokenVault) external;

    /// @dev Updates the allowlist status of a code hash.
    /// @param codeHash Hash of the code to update.
    /// @param isValid Boolean flag indicating whether the code hash must be considered valid.
    function setCodeHash(bytes32 codeHash, bool isValid) external;

    // ============ View Functions ============

    /// @dev Checks whether a token Vault is allowed.
    /// @param tokenVault Address of the token Vault to check.
    /// @return Boolean flag indicating whether the token Vault is allowed.
    function isTokenVaultAllowed(address tokenVault) external view returns (bool);

    /// @dev Checks whether a code hash is in the allowlist.
    /// @param codeHash Hash of the code to check.
    /// @return Boolean flag indicating whether the code hash is allowlisted.
    function codeHashWhiteList(bytes32 codeHash) external view returns (bool);

    /// @dev Validates a token Vault address.
    /// @param addr Address of the token Vault to validate.
    function validateTokenVault(address addr) external view;

    /// @dev Returns a list of all assets managed by token vaults.
    /// @return Array of asset addresses currently managed by token vaults.
    function getAssetList() external view returns (address[] memory);
}
