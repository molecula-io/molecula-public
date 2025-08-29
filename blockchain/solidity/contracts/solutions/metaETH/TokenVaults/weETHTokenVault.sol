// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.30;

import {BaseTokenVault} from "./../../../coreV2/TokenVault/BaseTokenVault.sol";
import {IweETH} from "./../externals/IweETH.sol";
import {MetaERC20TokenVault} from "./MetaERC20TokenVault.sol";

/// @title WeETHTokenVault
/// @dev Vault contract for managing weETH token deposits and withdrawals in the metaETH system.
contract WeETHTokenVault is MetaERC20TokenVault {
    // ============ Constructor ============

    /// @dev Initializes `WeETHTokenVault` with required dependencies.
    /// @param owner_ Address that will own the Vault.
    /// @param shareAddress metaETH token contract's address.
    /// @param supplyManager Supply Manager contract's address.
    /// @param guardianAddress Address of the Guardian that can pause operations.
    constructor(
        address owner_,
        address shareAddress,
        address supplyManager,
        address guardianAddress
    ) MetaERC20TokenVault(owner_, shareAddress, supplyManager, guardianAddress) {}

    // ============ View Functions ============

    /// @inheritdoc BaseTokenVault
    function convertAssetsToMoleculaAssets(
        uint256 assets
    ) public view virtual override returns (uint256 moleculaAssets) {
        moleculaAssets = IweETH(_asset).getEETHByWeETH(assets);
    }

    /// @inheritdoc BaseTokenVault
    function convertMoleculaAssetsToAssets(
        uint256 moleculaAssets
    ) public view virtual override returns (uint256 assets) {
        assets = IweETH(_asset).getWeETHByeETH(moleculaAssets);
    }
}
