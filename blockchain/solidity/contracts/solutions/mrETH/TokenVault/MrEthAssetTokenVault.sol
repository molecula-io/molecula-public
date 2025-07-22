// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.30;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Guardian} from "./../../../common/pausable/Guardian.sol";
import {IERC7575} from "./../../../coreV2/external/interfaces/IERC7575.sol";
import {BaseTokenVault} from "./../../../coreV2/TokenVault/BaseTokenVault.sol";
import {ERC20TokenVault} from "./../../../coreV2/TokenVault/ERC20TokenVault.sol";

/// @title MrEthAssetTokenVault
/// @notice Vault contract for managing ERC20 token deposits and withdrawals in the mrETH system.
/// @dev Extends `TokenVault` to implement the mrETH-specific functionality for ERC20 token handling.
contract MrEthAssetTokenVault is ERC20TokenVault {
    /// @dev Initializes `MrEthAssetTokenVault` with required dependencies.
    /// @param owner_ Address that will own the Vault.
    /// @param shareAddress Address of the mrETH token contract.
    /// @param supplyManager Address of the Supply Manager contract.
    /// @param guardianAddress Address of the Guardian that can pause operations.
    constructor(
        address owner_,
        address shareAddress,
        address supplyManager,
        address guardianAddress
    ) BaseTokenVault(shareAddress, supplyManager) Ownable(owner_) Guardian(guardianAddress) {}

    /// @inheritdoc IERC7575
    function totalAssets() external pure returns (uint256 /*totalManagedAssets*/) {
        // TODO: Will be supported with the redeem flow.
        revert ENotSupported();
    }
}
