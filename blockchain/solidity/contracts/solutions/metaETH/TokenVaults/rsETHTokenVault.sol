// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.30;

import {BaseTokenVault} from "./../../../coreV2/TokenVault/BaseTokenVault.sol";
import {ILRTOracle} from "./../externals/ILRTOracle.sol";
import {MetaERC20TokenVault} from "./MetaERC20TokenVault.sol";

/// @title RsETHTokenVault
/// @dev Vault contract for managing ezETH token deposits and withdrawals in the metaETH system.
contract RsETHTokenVault is MetaERC20TokenVault {
    /// @dev Renzo restake manager contract
    address public immutable LRT_ORACLE;

    // ============ Constructor ============

    /// @dev Initializes `RsETHTokenVault` with required dependencies.
    /// @param owner_ Address that will own the Vault.
    /// @param shareAddress metaETH token contract's address.
    /// @param supplyManager Supply Manager contract's address.
    /// @param guardianAddress Address of the Guardian that can pause operations.
    /// @param lrtOracle Address of the LRTOracle contract.
    constructor(
        address owner_,
        address shareAddress,
        address supplyManager,
        address guardianAddress,
        address lrtOracle
    )
        MetaERC20TokenVault(owner_, shareAddress, supplyManager, guardianAddress)
        notZeroAddress(lrtOracle)
    {
        LRT_ORACLE = lrtOracle;
    }

    // ============ View Functions ============

    /// @inheritdoc BaseTokenVault
    function convertAssetsToMoleculaAssets(
        uint256 assets
    ) public view virtual override returns (uint256 moleculaAssets) {
        // See https://github.com/Kelp-DAO/LRT-rsETH/blob/c289b81/contracts/LRTDepositPool.sol#L455
        uint256 rsETHPrice = ILRTOracle(LRT_ORACLE).rsETHPrice();
        moleculaAssets = (assets * rsETHPrice) / 1e18;
    }

    /// @inheritdoc BaseTokenVault
    function convertMoleculaAssetsToAssets(
        uint256 moleculaAssets
    ) public view virtual override returns (uint256 assets) {
        uint256 rsETHPrice = ILRTOracle(LRT_ORACLE).rsETHPrice();
        assets = (moleculaAssets * 1e18) / rsETHPrice;
    }
}
