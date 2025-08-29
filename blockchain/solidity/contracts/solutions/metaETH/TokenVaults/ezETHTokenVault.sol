// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {BaseTokenVault} from "./../../../coreV2/TokenVault/BaseTokenVault.sol";
import {IRestakeManager} from "./../externals/IRestakeManager.sol";
import {MetaERC20TokenVault} from "./MetaERC20TokenVault.sol";

/// @title EzETHTokenVault
/// @dev Vault contract for managing ezETH token deposits and withdrawals in the metaETH system.
contract EzETHTokenVault is MetaERC20TokenVault {
    /// @dev Renzo restake manager contract
    address public immutable RESTAKE_MANAGER;

    // ============ Constructor ============

    /// @dev Initializes `EzETHTokenVault` with required dependencies.
    /// @param owner_ Address that will own the Vault.
    /// @param shareAddress metaETH token contract's address.
    /// @param supplyManager Supply Manager contract's address.
    /// @param guardianAddress Address of the Guardian that can pause operations.
    /// @param restakeManager_ Address of the Renzo RestakeManager contract that manages ezETH staking.
    constructor(
        address owner_,
        address shareAddress,
        address supplyManager,
        address guardianAddress,
        address restakeManager_
    )
        MetaERC20TokenVault(owner_, shareAddress, supplyManager, guardianAddress)
        notZeroAddress(restakeManager_)
    {
        RESTAKE_MANAGER = restakeManager_;
    }

    // ============ View Functions ============

    /// @inheritdoc BaseTokenVault
    function convertAssetsToMoleculaAssets(
        uint256 assets
    ) public view virtual override returns (uint256 moleculaAssets) {
        (uint256 ezSupply, uint256 szTotalSuppy) = _getEzSharesAndSupply();
        // See formula of converting eth to ezETH
        // https://github.com/Renzo-Protocol/contracts-public/blob/v2.1/contracts/Oracle/RenzoOracle.sol#L129
        moleculaAssets = (ezSupply * assets) / szTotalSuppy;
    }

    /// @inheritdoc BaseTokenVault
    function convertMoleculaAssetsToAssets(
        uint256 moleculaAssets
    ) public view virtual override returns (uint256 assets) {
        (uint256 ezSupply, uint256 szTotalSuppy) = _getEzSharesAndSupply();
        assets = (szTotalSuppy * moleculaAssets) / ezSupply;
    }

    /// @dev Gets the total value locked (TVL) and total supply of ezETH tokens.
    /// @return ezTotalTVL The total value locked in the protocol across all operator delegators.
    /// @return ezTotalSupply The total supply of ezETH tokens in circulation.
    function _getEzSharesAndSupply()
        internal
        view
        virtual
        returns (uint256 ezTotalTVL, uint256 ezTotalSupply)
    {
        // slither-disable-next-line unused-return
        (, , ezTotalTVL) = IRestakeManager(RESTAKE_MANAGER).calculateTVLs();
        ezTotalSupply = IERC20(_asset).totalSupply();
    }
}
