// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.30;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Guardian} from "./../../../common/pausable/Guardian.sol";
import {IERC7575} from "./../../../coreV2/external/interfaces/IERC7575.sol";
import {ISupplyManagerV2} from "./../../../coreV2/interfaces/ISupplyManagerV2.sol";
import {BaseTokenVault} from "./../../../coreV2/TokenVault/BaseTokenVault.sol";
import {ERC20TokenVault} from "./../../../coreV2/TokenVault/ERC20TokenVault.sol";

/// @title MetaERC20TokenVault
/// @dev Vault contract for managing ERC20 token deposits and withdrawals in the metaETH system.
contract MetaERC20TokenVault is ERC20TokenVault {
    // ============ Constructor ============

    /// @dev Initializes `MetaERC20TokenVault` with required dependencies.
    /// @param owner_ Address that will own the Vault.
    /// @param shareAddress metaETH token contract's address.
    /// @param supplyManager Supply Manager contract's address.
    /// @param guardianAddress Address of the Guardian that can pause operations.
    constructor(
        address owner_,
        address shareAddress,
        address supplyManager,
        address guardianAddress
    ) BaseTokenVault(shareAddress, supplyManager) Ownable(owner_) Guardian(guardianAddress) {}

    // ============ View Functions ============

    /// @inheritdoc IERC7575
    function totalAssets() external view virtual override returns (uint256 totalManagedAssets) {
        address metaPoolTreasury = ISupplyManagerV2(SUPPLY_MANAGER).getMoleculaPool();
        totalManagedAssets = IERC20(_asset).balanceOf(metaPoolTreasury);
    }
}
