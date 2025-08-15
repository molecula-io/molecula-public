// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.30;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Guardian} from "./../../../common/pausable/Guardian.sol";
import {IERC7575Payable} from "./../../../coreV2/external/interfaces/IERC7575Payable.sol";
import {ISupplyManagerV2} from "./../../../coreV2/interfaces/ISupplyManagerV2.sol";
import {BaseTokenVault} from "./../../../coreV2/TokenVault/BaseTokenVault.sol";
import {ITokenVaultWithImmediateRedeem} from "./../../../coreV2/TokenVault/interfaces/ITokenVaultWithImmediateRedeem.sol";
import {NativeTokenVault} from "./../../../coreV2/TokenVault/NativeTokenVault.sol";
import {IMetaPoolTreasury} from "../interfaces/IMetaPoolTreasury.sol";

/// @title metaETHNativeTokenVault
/// @notice Vault contract for managing native ETH deposits and withdrawals in the metaETH system.
/// @dev Extends `NativeTokenVault` to implement the metaETH-specific functionality for native ETH handling.
contract MetaNativeTokenVault is ITokenVaultWithImmediateRedeem, NativeTokenVault {
    // ============ Constructor ============

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

    // ============ Core functions ============

    /// @dev Allows the contract to receive ETH.
    receive()
        external
        payable
        virtual
        override
        only(ISupplyManagerV2(SUPPLY_MANAGER).getMoleculaPool())
    {}

    /// @inheritdoc ITokenVaultWithImmediateRedeem
    function redeemImmediately(
        uint256 shares,
        address receiver,
        address owner
    ) external virtual onlyOperator(owner) returns (uint256 requestId) {
        // Redeem the claimable assets.
        uint256 claimableRedeemShares = convertToShares(_redeemInfo[owner].claimableRedeemAssets);
        if (claimableRedeemShares > 0) {
            if (shares <= claimableRedeemShares) {
                _withdraw(convertToAssets(shares), receiver, owner);
                return 0;
            }

            shares -= claimableRedeemShares;
            _withdraw(convertToAssets(claimableRedeemShares), receiver, owner);
        }

        // Request to redeem the remaining shares.
        // slither-disable-next-line reentrancy-no-eth
        requestId = _requestRedeem(shares, msg.sender, owner);

        // Find the Molecula Pool's address.
        address moleculaPool = ISupplyManagerV2(SUPPLY_MANAGER).getMoleculaPool();

        // Try to redeem from the Pool.
        uint256[] memory requestIds = new uint256[](1);
        requestIds[0] = requestId;
        // slither-disable-next-line reentrancy-no-eth
        IMetaPoolTreasury(moleculaPool).fulfillRedeemRequestsForNativeToken(requestIds);

        // Withdraw the redeemed assets.
        _withdraw(_redeemInfo[msg.sender].claimableRedeemAssets, receiver, msg.sender);
    }

    // ============ View Functions ============

    /// @inheritdoc IERC7575Payable
    function totalAssets() external view virtual override returns (uint256 totalManagedAssets) {
        address metaPoolTreasury = ISupplyManagerV2(SUPPLY_MANAGER).getMoleculaPool();
        totalManagedAssets = address(metaPoolTreasury).balance;
    }
}
