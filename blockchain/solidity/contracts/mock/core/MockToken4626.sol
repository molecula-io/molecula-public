// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/* solhint-disable gas-custom-errors */

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockToken4626 is ERC4626 {
    bool public hasPreviewDeposit = true;
    bool public hasPreviewRedeem = true;

    constructor(IERC20 asset_) ERC20("MockToken4626", "MT4626") ERC4626(asset_) {}

    /// @inheritdoc ERC4626
    function previewDeposit(uint256 assets) public view virtual override returns (uint256) {
        if (hasPreviewDeposit) {
            return super.previewDeposit(assets);
        }
        revert("No previewDeposit");
    }

    /// @inheritdoc ERC4626
    function previewRedeem(uint256 shares) public view virtual override returns (uint256) {
        if (hasPreviewRedeem) {
            return super.previewRedeem(shares);
        }
        revert("No previewRedeem");
    }

    function setPreviewDeposit(bool has) external {
        hasPreviewDeposit = has;
    }

    function setPreviewRedeem(bool has) external {
        hasPreviewRedeem = has;
    }
}
