// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Guardian} from "./../../../common/pausable/Guardian.sol";
import {IERC7575Payable} from "./../../../coreV2/external/interfaces/IERC7575Payable.sol";
import {BaseTokenVault} from "./../../../coreV2/TokenVault/BaseTokenVault.sol";
import {NativeTokenVault} from "./../../../coreV2/TokenVault/NativeTokenVault.sol";

/// @title MrEthNativeTokenVault
/// @notice Vault contract for managing native ETH deposits and withdrawals in the mrETH system.
/// @dev Extends `NativeTokenVault` to implement the mrETH-specific functionality for native ETH handling.
contract MrEthNativeTokenVault is NativeTokenVault {
    /// @dev Initializes `MrEthNativeTokenVault` with required dependencies.
    /// @param initialOwner Address that will own the Vault.
    /// @param shareAddress Address of the mrETH share token contract.
    /// @param supplyManager Address of the Supply Manager contract.
    /// @param guardianAddress Address of the Guardian that can pause operations.
    constructor(
        address initialOwner,
        address shareAddress,
        address supplyManager,
        address guardianAddress
    ) BaseTokenVault(shareAddress, supplyManager) Guardian(guardianAddress) Ownable(initialOwner) {}

    /// @inheritdoc IERC7575Payable
    function totalAssets() external pure returns (uint256 /*totalManagedAssets*/) {
        // TODO: Will be supported with redeem flow
        revert ENotSupported();
    }
}
