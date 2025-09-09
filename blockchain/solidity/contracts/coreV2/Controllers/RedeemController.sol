// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.30;

import {IERC7575} from "./../external/interfaces/IERC7575.sol";
import {ISupplyManagerV2} from "./../interfaces/ISupplyManagerV2.sol";
import {IRedeemController} from "./interfaces/IRedeemController.sol";

contract RedeemController is IRedeemController {
    // ============ State Variables ============

    /// @notice Supply Manager contract.
    /// @dev Handles redeem operations.
    ISupplyManagerV2 public immutable SUPPLY_MANAGER;

    /// @notice Mapping of redeemed requests.
    /// @dev `requestId` is the key and `isRedeemed` is a boolean indicating if the request has been redeemed.
    mapping(uint256 requestId => bool isRedeemed) public isRequestRedeemed;

    // ============ Constructor ============

    /// @dev Constructor.
    /// @param supplyManager Supply Manager contract's address.
    constructor(address supplyManager) {
        SUPPLY_MANAGER = ISupplyManagerV2(supplyManager);
    }

    // ============ Core Functions ============

    /// @inheritdoc IRedeemController
    function redeem(uint256[] calldata requestIds) external virtual returns (uint256 shares) {
        // Get the length of the `requestIds` array.
        uint256 length = requestIds.length;

        // Iterate through the `requestIds` array.
        for (uint256 i = 0; i < length; ++i) {
            // Call the `_redeem` function to redeem the request.
            shares += _redeem(requestIds[i]);
        }
    }

    /// @dev Redeems a request.
    /// @param requestId Request's ID.
    /// @return shares Amount of shares redeemed.
    function _redeem(uint256 requestId) internal virtual returns (uint256 shares) {
        // Call the Supply Manager to get the redemption request details.
        // slither-disable-next-line unused-return
        (
            address tokenVault,
            ISupplyManagerV2.RequestState state,
            address controller,
            address owner,
            uint256 assets,

        ) = ISupplyManagerV2(SUPPLY_MANAGER).redeemRequests(requestId);

        // Check if the redeem request is in the `Claimable` status.
        if (state != ISupplyManagerV2.RequestState.Claimable) {
            revert ERedeemRequestNotClaimable(requestId);
        }

        // Check if the request has been redeemed.
        if (isRequestRedeemed[requestId]) {
            revert ERedeemRequestAlreadyRedeemed(requestId);
        }

        // Mark the request as redeemed.
        isRequestRedeemed[requestId] = true;

        // Withdraw the assets from `TokenVault` to the `requestId` owner.
        // Note: The controller address should match the address of this contract.
        // The validation is performed in `TokenVault`.
        shares = IERC7575(tokenVault).withdraw(assets, owner, controller);

        // Emit a `Redeem` event.
        emit Redeem(requestId, owner, controller, assets);
    }
}
