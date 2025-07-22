// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.30;

import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IAgent} from "./../../common/interfaces/IAgent.sol";
import {ISupplyManager} from "./../../common/interfaces/ISupplyManager.sol";
import {Guardian} from "./../../common/pausable/Guardian.sol";
import {PriceCheckerClient} from "./../../common/PriceChecker/PriceCheckerClient.sol";
import {RebaseTokenOwner} from "./../../common/rebase/RebaseTokenOwner.sol";
import {MoleculaPoolTreasuryV2, TokenType} from "./../../core/MoleculaPoolTreasuryV2.sol";
import {IERC7575} from "./../../coreV2/external/interfaces/IERC7575.sol";
import {BaseTokenVault} from "./../../coreV2/TokenVault/BaseTokenVault.sol";
import {CommonTokenVault} from "./../../coreV2/TokenVault/CommonTokenVault.sol";
import {INitrogenTokenVault} from "./interfaces/INitrogenTokenVault.sol";

/// @dev Specialized Vault implementing asynchronous redemption flows following the ERC-7540 standard,
/// with synchronous deposit functionality following ERC-4626. This Vault integrates with
/// RebaseTokenOwner for token supply management and MoleculaPoolTreasury for the underlying asset handling.
/// @notice Price feed configuration is used to check that the asset price is approximately equal
/// to the expected price, within the allowed deviation.
contract NitrogenTokenVault is INitrogenTokenVault, IAgent, CommonTokenVault, PriceCheckerClient {
    using SafeERC20 for IERC20;

    // ============ State Variables ============

    /// @dev Rebase token owner contract responsible for minting and managing rebase tokens.
    RebaseTokenOwner public immutable REBASE_TOKEN_OWNER;

    /// @dev Stores redemption request information indexed by a request ID.
    mapping(uint256 requestId => RequestInfo) public redeemRequests;

    // ============ Constructor ============

    /// @dev Sets up the Vault with required dependencies and security controls.
    /// @param initialOwner Contract owner's address.
    /// @param shareAddress Address of the ERC7575 share token contract.
    /// @param supplyManager Address of the supply management contract.
    /// @param tokenOwner Instance of the RebaseTokenOwner contract for managing rebase tokens.
    /// @param guardianAddress Address with pause privileges for emergency functions.
    /// @param priceChecker_ Address of the price checker contract used to validate asset prices.
    constructor(
        address initialOwner,
        address shareAddress,
        address supplyManager,
        RebaseTokenOwner tokenOwner,
        address guardianAddress,
        address priceChecker_
    )
        BaseTokenVault(shareAddress, supplyManager)
        Guardian(guardianAddress)
        Ownable(initialOwner)
        PriceCheckerClient(priceChecker_)
    {
        REBASE_TOKEN_OWNER = tokenOwner;
    }

    // ============ Core Functions ============

    /// @inheritdoc IAgent
    // slither-disable-next-line locked-ether
    function distribute(
        address[] calldata users,
        uint256[] calldata shares
    ) external payable virtual override zeroMsgValue only(SUPPLY_MANAGER) {
        REBASE_TOKEN_OWNER.distribute(users, shares);
        // Emit an event to log the operation.
        emit DistributeYield(users, shares);
    }

    /// @inheritdoc IAgent
    // slither-disable-next-line locked-ether
    function redeem(
        address assetOwner,
        uint256[] calldata requestIds,
        uint256[] calldata assets,
        uint256 sumAssets
    ) external payable virtual override zeroMsgValue only(SUPPLY_MANAGER) {
        // slither-disable-next-line arbitrary-send-erc20
        IERC20(_asset).safeTransferFrom(assetOwner, address(this), sumAssets);

        uint256 length = requestIds.length;
        for (uint256 i = 0; i < length; ++i) {
            // If assets[i] == 0 than requestIds[i] is already processed.
            if (assets[i] > 0) {
                // Store the assets' amount for this request.
                RequestInfo storage requestInfo = redeemRequests[requestIds[i]];
                requestInfo.assets = assets[i];

                // Decrease the pending shares since the request is fulfilled and
                // increase the amount of claimable assets that the user can withdraw.
                RedeemInfo storage redeemInfo = _redeemInfo[requestInfo.controller];
                redeemInfo.pendingRedeemShares -= requestInfo.shares;
                redeemInfo.claimableRedeemAssets += requestInfo.assets;
            }
        }

        // Emit an event to log the redemption operation.
        emit RedeemClaimable(requestIds, assets);
    }

    /// @inheritdoc INitrogenTokenVault
    function redeemImmediately(
        uint256 shares,
        address receiver,
        address owner
    ) external virtual override onlyOperator(owner) returns (uint256 requestId) {
        // Redeem the claimable assets.
        uint256 claimableRedeemShares = convertToShares(_redeemInfo[owner].claimableRedeemAssets);
        if (0 < claimableRedeemShares) {
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
        address moleculaPool = ISupplyManager(SUPPLY_MANAGER).getMoleculaPool();

        // Try to redeem from the Pool.
        uint256[] memory requestIds = new uint256[](1);
        requestIds[0] = requestId;
        // slither-disable-next-line reentrancy-no-eth
        MoleculaPoolTreasuryV2(moleculaPool).redeem(requestIds);

        // Withdraw the redeemed assets.
        _withdraw(redeemRequests[requestId].assets, receiver, msg.sender);
    }

    /// @inheritdoc Ownable2Step
    function transferOwnership(address newOwner) public virtual override(Ownable, BaseTokenVault) {
        super.transferOwnership(newOwner);
    }

    // ============ View Functions ============

    /// @inheritdoc CommonTokenVault
    function asset()
        public
        view
        virtual
        override(CommonTokenVault, PriceCheckerClient)
        returns (address)
    {
        return super.asset();
    }

    /// @inheritdoc BaseTokenVault
    function _issuer() internal view virtual override returns (address) {
        return address(REBASE_TOKEN_OWNER);
    }

    /// @inheritdoc BaseTokenVault
    function convertAssetsToMoleculaAssets(
        uint256 assets
    ) public view virtual override returns (uint256 moleculaAssets) {
        // Get a Molecula Pool instance for conversion calculations.
        address moleculaPool = ISupplyManager(SUPPLY_MANAGER).getMoleculaPool();
        MoleculaPoolTreasuryV2 poolTreasury = MoleculaPoolTreasuryV2(moleculaPool);

        // Get the token configuration from the Pool map.
        // slither-disable-next-line unused-return
        (TokenType tokenType, , int8 n, , ) = poolTreasury.poolMap(_asset);
        if (tokenType == TokenType.None) {
            revert MoleculaPoolTreasuryV2.ETokenNotExist();
        }
        if (tokenType == TokenType.ERC20) {
            moleculaAssets = assets * (uint256(10) ** uint256(int256(n)));
        } else {
            uint256 assets4626 = IERC4626(_asset).convertToAssets(assets);
            moleculaAssets = assets4626 * (uint256(10) ** uint256(int256(n)));
        }
    }

    /// @inheritdoc BaseTokenVault
    function convertMoleculaAssetsToAssets(
        uint256 moleculaAssets
    ) public view virtual override returns (uint256 assets) {
        address moleculaPool = ISupplyManager(SUPPLY_MANAGER).getMoleculaPool();
        MoleculaPoolTreasuryV2 poolTreasury = MoleculaPoolTreasuryV2(moleculaPool);

        // See `MoleculaPoolTreasury.requestRedeem`.
        // slither-disable-next-line unused-return
        (TokenType tokenType, , int8 n, , ) = poolTreasury.poolMap(_asset);
        if (tokenType == TokenType.None) {
            revert MoleculaPoolTreasuryV2.ETokenNotExist();
        }

        if (tokenType == TokenType.ERC20) {
            assets = moleculaAssets / (uint256(10) ** uint256(int256(n)));
        } else {
            uint256 assets2 = moleculaAssets / (uint256(10) ** uint256(int256(n)));
            assets = IERC4626(_asset).convertToShares(assets2);
        }
    }

    /// @inheritdoc IERC7575
    function totalAssets() external view virtual override returns (uint256 totalManagedAssets) {
        // Total amount of the underlying asset managed by the Vault.
        address moleculaPool = ISupplyManager(SUPPLY_MANAGER).getMoleculaPool();
        return IERC20(_asset).balanceOf(moleculaPool);
    }

    /// @inheritdoc IAgent
    function getERC20Token() external view virtual override returns (address token) {
        return _asset;
    }

    // ============ Internal Functions ============

    /// @inheritdoc BaseTokenVault
    function _requestDeposit(
        uint256 assets,
        address receiver,
        address owner
    ) internal virtual override returns (uint256 requestId, uint256 shares) {
        checkPrice();
        return super._requestDeposit(assets, receiver, owner);
    }

    /// @inheritdoc BaseTokenVault
    function _requestRedeem(
        uint256 shares,
        address controller,
        address owner
    ) internal virtual override returns (uint256 requestId) {
        checkPrice();
        return super._requestRedeem(shares, controller, owner);
    }

    /// @inheritdoc BaseTokenVault
    function _supplyManagerRequestRedeem(
        address /*controller*/,
        address /*owner*/,
        uint256 requestId,
        uint256 shares
    ) internal virtual override returns (uint256 assets) {
        assets = ISupplyManager(SUPPLY_MANAGER).requestRedeem(_asset, requestId, shares);
    }

    /// @inheritdoc BaseTokenVault
    function _storeRedeemRequestInfo(
        uint256 requestId,
        address controller,
        address owner,
        uint256 shares
    ) internal virtual override {
        // Store the redemption operation in the `redeemRequests` mapping.
        redeemRequests[requestId] = RequestInfo({
            controller: controller,
            owner: owner,
            assets: 0, // Set the correct value in the `_fulfillRedeemRequests` function.
            shares: shares
        });
    }

    /// @inheritdoc Ownable2Step
    function _transferOwnership(
        address newOwner
    ) internal virtual override(Ownable, BaseTokenVault) {
        super._transferOwnership(newOwner);
    }
}
