// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.30;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC165} from "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import {Guardian} from "./../../../common/pausable/Guardian.sol";
import {IERC7575} from "./../../../coreV2/external/interfaces/IERC7575.sol";
import {ISupplyManagerV2} from "./../../../coreV2/interfaces/ISupplyManagerV2.sol";
import {BaseTokenVault} from "./../../../coreV2/TokenVault/BaseTokenVault.sol";
import {CommonTokenVault} from "./../../../coreV2/TokenVault/CommonTokenVault.sol";
import {ERC20TokenVault} from "./../../../coreV2/TokenVault/ERC20TokenVault.sol";
import {IDepositManagerPool} from "./../interfaces/IDepositManagerPool.sol";
import {MrEthBaseTokenVault} from "./MrEthBaseTokenVault.sol";

/// @title MrEthAssetTokenVault.
/// @notice Vault contract for managing ERC20 token deposits and withdrawals in the mrETH system.
/// @dev Extends `TokenVault` to implement the mrETH-specific functionality for ERC20 token handling.
contract MrEthAssetTokenVault is ERC20TokenVault, MrEthBaseTokenVault {
    /// @dev Initializes `MrEthAssetTokenVault` with required dependencies.
    /// @param initialOwner Address that will own the Vault.
    /// @param shareAddress Address of the mrETH token contract.
    /// @param supplyManager Address of the Supply Manager contract.
    /// @param guardianAddress Address of the Guardian that can pause operations.
    /// @param yieldDistributor_ Address of the immediate redemption Yield Distributor.
    constructor(
        address initialOwner,
        address shareAddress,
        address supplyManager,
        address guardianAddress,
        address yieldDistributor_
    )
        Guardian(guardianAddress)
        BaseTokenVault(shareAddress, supplyManager)
        Ownable(initialOwner)
        MrEthBaseTokenVault(yieldDistributor_)
    {}

    /// @inheritdoc ERC165
    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override(BaseTokenVault, CommonTokenVault) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    /// @inheritdoc IERC7575
    function convertToAssets(
        uint256 shares
    ) public view virtual override(BaseTokenVault, CommonTokenVault) returns (uint256 assets) {
        assets = super.convertToAssets(shares);
    }

    /// @inheritdoc IERC7575
    function convertToShares(
        uint256 assets
    ) public view virtual override(BaseTokenVault, CommonTokenVault) returns (uint256 shares) {
        shares = super.convertToShares(assets);
    }

    /// @inheritdoc IERC7575
    function maxRedeem(
        address owner
    ) public view virtual override(BaseTokenVault, CommonTokenVault) returns (uint256 maxShares) {
        return super.maxRedeem(owner);
    }

    /// @inheritdoc ERC20TokenVault
    function _init(
        address asset_,
        uint128 minDepositAssets_,
        uint128 minRedeemShares_
    ) internal virtual override(BaseTokenVault, ERC20TokenVault) {
        super._init(asset_, minDepositAssets_, minRedeemShares_);
    }

    /// @inheritdoc IERC7575
    function totalAssets() external view returns (uint256 totalManagedAssets) {
        address moleculaPool = ISupplyManagerV2(SUPPLY_MANAGER).getMoleculaPool();
        totalManagedAssets = IDepositManagerPool(moleculaPool).getTokenSupply(_asset);
    }
}
