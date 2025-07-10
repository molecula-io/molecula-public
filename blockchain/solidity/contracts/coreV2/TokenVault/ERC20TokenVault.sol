// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.28;

import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {BaseTokenVault} from "./BaseTokenVault.sol";
import {TokenVault} from "./TokenVault.sol";

/// @title ERC20TokenVault
/// @notice Underlying asset is an ERC-20 token, not its extensions like ERC-4626.
abstract contract ERC20TokenVault is TokenVault {
    /// @dev Power of 10 used to convert between assets and Molecula Tokens.
    uint128 public pow10;

    /// @inheritdoc BaseTokenVault
    function _init(
        address asset_,
        uint128 minDepositAssets_,
        uint128 minRedeemShares_
    ) internal virtual override {
        super._init(asset_, minDepositAssets_, minRedeemShares_);
        uint128 assetDecimals = IERC20Metadata(_asset).decimals();
        uint128 shareDecimals = IERC20Metadata(_SHARE).decimals();
        pow10 = uint128(10) ** (shareDecimals - assetDecimals);
    }

    /// @inheritdoc BaseTokenVault
    function convertAssetsToMoleculaAssets(
        uint256 assets
    ) public view virtual override returns (uint256 moleculaAssets) {
        moleculaAssets = assets * pow10;
    }

    /// @inheritdoc BaseTokenVault
    function convertMoleculaAssetsToAssets(
        uint256 moleculaAssets
    ) public view virtual override returns (uint256 assets) {
        assets = moleculaAssets / pow10;
    }
}
