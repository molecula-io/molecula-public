// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.30;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC165} from "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import {Guardian} from "./../../../common/pausable/Guardian.sol";
import {IERC7575Payable} from "./../../../coreV2/external/interfaces/IERC7575Payable.sol";
import {ISupplyManagerV2} from "./../../../coreV2/interfaces/ISupplyManagerV2.sol";
import {BaseTokenVault} from "./../../../coreV2/TokenVault/BaseTokenVault.sol";
import {NativeTokenVault} from "./../../../coreV2/TokenVault/NativeTokenVault.sol";
import {IDepositManagerWithImmediateRedeem} from "./../interfaces/IDepositManagerPool.sol";
import {IDepositManagerPool} from "./../interfaces/IDepositManagerPool.sol";
import {MrEthBaseTokenVault} from "./MrEthBaseTokenVault.sol";

/// @title MrEthNativeTokenVault.
/// @notice Vault contract for managing native ETH deposits and withdrawals in the mrETH system.
/// @dev Extends `NativeTokenVault` to implement the mrETH-specific functionality for native ETH handling.
contract MrEthNativeTokenVault is NativeTokenVault, MrEthBaseTokenVault {
    /// @dev Initializes `MrEthNativeTokenVault` with required dependencies.
    /// @param initialOwner Address that will own the Vault.
    /// @param shareAddress Address of the mrETH share token contract.
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
    ) public view virtual override(NativeTokenVault, BaseTokenVault) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    /// @inheritdoc IERC7575Payable
    function convertToAssets(
        uint256 shares
    ) public view virtual override(NativeTokenVault, BaseTokenVault) returns (uint256 assets) {
        assets = super.convertToAssets(shares);
    }

    /// @inheritdoc IERC7575Payable
    function convertToShares(
        uint256 assets
    ) public view virtual override(NativeTokenVault, BaseTokenVault) returns (uint256 shares) {
        shares = super.convertToShares(assets);
    }

    /// @inheritdoc IERC7575Payable
    function maxRedeem(
        address owner
    ) public view virtual override(NativeTokenVault, BaseTokenVault) returns (uint256 maxShares) {
        return super.maxRedeem(owner);
    }

    /// @inheritdoc IERC7575Payable
    function totalAssets() external view returns (uint256 totalManagedAssets) {
        address moleculaPool = ISupplyManagerV2(SUPPLY_MANAGER).getMoleculaPool();
        totalManagedAssets = IDepositManagerPool(moleculaPool).getTokenSupply(_asset);
    }

    /// @dev Redeems the assets from the Molecula Pool.
    /// @param requestId Redemption operation's ID.
    function _redeemImmediatelyFromPool(uint256 requestId) internal virtual override {
        // Get the Molecula Pool's address.
        address moleculaPool = ISupplyManagerV2(SUPPLY_MANAGER).getMoleculaPool();

        // Create a request ID array.
        uint256[] memory requestIds = new uint256[](1);
        requestIds[0] = requestId;

        // Redeem the assets from the Molecula Pool.
        IDepositManagerWithImmediateRedeem(moleculaPool).fulfillRedeemImmediatelyForNativeToken(
            requestIds
        );
    }
}
