// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ERC165} from "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import {IERC7540Deposit} from "../external/interfaces/IERC7540.sol";
import {IERC7575} from "../external/interfaces/IERC7575.sol";
import {ISupplyManagerV2} from "./../interfaces/ISupplyManagerV2.sol";
import {BaseTokenVault} from "./BaseTokenVault.sol";
import {IBaseTokenVault} from "./interfaces/ITokenVault.sol";

/// @title CommonTokenVault.
/// @dev Vault is used for solutions based on CoreV2. Only for ERC-20 non-native tokens.
///      Vault that implements only asynchronous requests for redemption flows with ERC-7540.
///      Deposit flow is synchronous with ERC-4626, while also supporting ERC-7540.
abstract contract CommonTokenVault is BaseTokenVault, IERC7575, IERC7540Deposit {
    using SafeERC20 for IERC20;

    // ============ Core Functions ============

    /// @inheritdoc IBaseTokenVault
    function init(
        address asset_,
        uint128 minDepositAssets_,
        uint128 minRedeemShares_
    ) external virtual override onlyOwner {
        _init(asset_, minDepositAssets_, minRedeemShares_);

        // Infinity approve to the Molecula Pool.
        IERC20(_asset).forceApprove(
            ISupplyManagerV2(SUPPLY_MANAGER).getMoleculaPool(),
            type(uint256).max
        );
    }

    /// @inheritdoc IERC7540Deposit
    function requestDeposit(
        uint256 assets,
        address controller,
        address owner
    ) external virtual override onlyOperator(owner) returns (uint256 requestId) {
        (requestId, ) = _requestDeposit(assets, controller, owner);
    }

    /// @inheritdoc IERC7540Deposit
    /// @dev Note: The controller of the request is equal to the asset's owner.
    function deposit(
        uint256 assets,
        address receiver,
        address controller
    ) external virtual override onlyOperator(controller) returns (uint256 requestId) {
        (requestId, ) = _requestDeposit(assets, receiver, controller);
    }

    /// @inheritdoc IERC7575
    function deposit(
        uint256 assets,
        address receiver
    ) external virtual override returns (uint256 shares) {
        (, shares) = _requestDeposit(assets, receiver, msg.sender);
    }

    /// @inheritdoc IERC7540Deposit
    function mint(
        uint256 shares,
        address receiver,
        address controller
    ) public virtual override onlyOperator(controller) returns (uint256 assets) {
        assets = convertToAssets(shares);
        _requestDeposit(assets, receiver, controller);
    }

    /// @inheritdoc IERC7575
    function mint(
        uint256 shares,
        address receiver
    ) external virtual override returns (uint256 assets) {
        return mint(shares, receiver, msg.sender);
    }

    /// @inheritdoc IBaseTokenVault
    function requestWithdraw(
        uint256 assets,
        address controller,
        address owner
    ) external virtual override onlyOperator(owner) returns (uint256 requestId) {
        uint256 shares = convertToShares(assets);
        return _requestRedeem(shares, controller, owner);
    }

    /// @inheritdoc IERC7575
    /// @dev ERC-7540: `The owner field of redeem and withdraw SHOULD be renamed to controller ...`
    function withdraw(
        uint256 assets,
        address receiver,
        address controller
    ) external virtual override onlyOperator(controller) returns (uint256 shares) {
        return _withdraw(assets, receiver, controller);
    }

    /// @inheritdoc IERC7575
    /// @dev ERC-7540: `The owner field of redeem and withdraw SHOULD be renamed to controller ...`
    function redeem(
        uint256 shares,
        address receiver,
        address controller
    ) external virtual override onlyOperator(controller) returns (uint256 assets) {
        assets = convertToAssets(shares);
        _withdraw(assets, receiver, controller);
    }

    // ============ View Functions ============

    /// @inheritdoc IERC7575
    function maxRedeem(
        address owner
    ) public view virtual override(IERC7575, BaseTokenVault) returns (uint256 maxShares) {
        return super.maxRedeem(owner);
    }

    /// @inheritdoc IERC7575
    function convertToAssets(
        uint256 shares
    ) public view virtual override(BaseTokenVault, IERC7575) returns (uint256 assets) {
        assets = super.convertToAssets(shares);
    }

    /// @inheritdoc IERC7575
    function convertToShares(
        uint256 assets
    ) public view virtual override(BaseTokenVault, IERC7575) returns (uint256 shares) {
        shares = super.convertToShares(assets);
    }

    /// @inheritdoc IERC7575
    function share() external view virtual override returns (address) {
        return _SHARE;
    }

    /// @inheritdoc IERC7575
    function asset() public view virtual override returns (address) {
        return _asset;
    }

    /// @inheritdoc IERC7540Deposit
    function pendingDepositRequest(
        uint256 /*requestId*/,
        address /*controller*/
    ) external pure virtual override returns (uint256 pendingShares) {
        // The deposit flow is not asynchronous as we don't follow IERC7540:
        // “Vaults must not 'push' tokens onto the user after a request”
        // Our Vault implementation takes user's assets and mints tokens for the user in one transaction.
        return 0;
    }

    /// @inheritdoc IERC7540Deposit
    function claimableDepositRequest(
        uint256 /*requestId*/,
        address /*controller*/
    ) external pure virtual override returns (uint256 claimableShares) {
        // See the comment in` CommonTokenVault.pendingDepositRequest`.
        return 0;
    }

    /// @inheritdoc IERC7575
    function maxDeposit(
        address /*receiver*/
    ) external pure virtual override returns (uint256 maxAssets) {
        return type(uint256).max;
    }

    /// @inheritdoc IERC7575
    function maxMint(
        address /*receiver*/
    ) external pure virtual override returns (uint256 maxShares) {
        return type(uint256).max;
    }

    /// @inheritdoc IERC7575
    function maxWithdraw(address owner) external view virtual override returns (uint256 maxAssets) {
        uint256 maxShares = maxRedeem(owner);
        return convertToAssets(maxShares);
    }

    /// @inheritdoc IERC7575
    function previewDeposit(
        uint256 assets
    ) external view virtual override returns (uint256 shares) {
        return convertToShares(assets);
    }

    /// @inheritdoc IERC7575
    function previewMint(uint256 shares) external view virtual override returns (uint256 assets) {
        return convertToAssets(shares);
    }

    /// @inheritdoc IERC7575
    function previewRedeem(
        uint256 /*shares*/
    ) external pure virtual override returns (uint256 /*assets*/) {
        // According to ERC-7540: "... MUST revert for all callers and inputs".
        revert EAsyncRedeem();
    }

    /// @inheritdoc IERC7575
    function previewWithdraw(
        uint256 /*assets*/
    ) external pure virtual override returns (uint256 /*shares*/) {
        // According to ERC-7540: "... MUST revert for all callers and inputs".
        revert EAsyncRedeem();
    }

    /// @inheritdoc ERC165
    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return
            type(IERC7540Deposit).interfaceId == interfaceId ||
            type(IERC7575).interfaceId == interfaceId ||
            super.supportsInterface(interfaceId);
    }

    // ============ Internal Functions ============

    /// @inheritdoc BaseTokenVault
    function _supplyManagerDeposit(
        uint256 requestId,
        uint256 assets
    ) internal virtual override returns (uint256 shares) {
        return ISupplyManagerV2(SUPPLY_MANAGER).deposit(_asset, requestId, assets);
    }

    /// @inheritdoc BaseTokenVault
    function _transferAssetsFromOwner(address owner, uint256 assets) internal virtual override {
        // Transfer the requested assets from the user.
        // slither-disable-next-line arbitrary-send-erc20
        IERC20(_asset).safeTransferFrom(owner, address(this), assets);
    }

    /// @inheritdoc BaseTokenVault
    function _transferAssetsToReceiver(address receiver, uint256 assets) internal virtual override {
        IERC20(_asset).safeTransfer(receiver, assets);
    }
}
