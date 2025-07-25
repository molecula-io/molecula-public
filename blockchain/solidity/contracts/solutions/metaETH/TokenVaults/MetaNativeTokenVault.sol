// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.30;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Guardian} from "./../../../common/pausable/Guardian.sol";
import {IERC7575Payable} from "./../../../coreV2/external/interfaces/IERC7575Payable.sol";
import {ISupplyManagerV2} from "./../../../coreV2/interfaces/ISupplyManagerV2.sol";
import {BaseTokenVault} from "./../../../coreV2/TokenVault/BaseTokenVault.sol";
import {NativeTokenVault} from "./../../../coreV2/TokenVault/NativeTokenVault.sol";

/// @title metaETHNativeTokenVault
/// @notice Vault contract for managing native ETH deposits and withdrawals in the metaETH system.
/// @dev Extends `NativeTokenVault` to implement the metaETH-specific functionality for native ETH handling.
contract MetaNativeTokenVault is NativeTokenVault {
    /// @dev Initializes `metaETHNativeTokenVault` with required dependencies.
    /// @param initialOwner Address that will own the Vault.
    /// @param shareAddress metaETH share token contract's address.
    /// @param supplyManager Supply Manager contract's address.
    /// @param guardianAddress Address of the Guardian that can pause operations.
    constructor(
        address initialOwner,
        address shareAddress,
        address supplyManager,
        address guardianAddress
    ) BaseTokenVault(shareAddress, supplyManager) Ownable(initialOwner) Guardian(guardianAddress) {}

    /// @dev Allows the contract to receive ETH.
    receive()
        external
        payable
        virtual
        override
        only(ISupplyManagerV2(SUPPLY_MANAGER).getMoleculaPool())
    {}

    /// @inheritdoc IERC7575Payable
    function totalAssets() external view virtual override returns (uint256 totalManagedAssets) {
        address metaPoolTreasury = ISupplyManagerV2(SUPPLY_MANAGER).getMoleculaPool();
        totalManagedAssets = address(metaPoolTreasury).balance;
    }
}
