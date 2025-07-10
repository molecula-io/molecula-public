// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.28;

import {ConstantsCoreV2} from "./../../contracts/coreV2/Constants.sol";
import {IERC7575} from "./external/interfaces/IERC7575.sol";
import {IMoleculaPoolV2WithNativeToken} from "./interfaces/IMoleculaPoolV2.sol";
import {ISupplyManagerV2WithNative} from "./interfaces/ISupplyManagerV2.sol";
import {SupplyManagerV2} from "./SupplyManagerV2.sol";
import {INativeTokenVault} from "./TokenVault/interfaces/ITokenVault.sol";

/// @title Supply Manager V2.
/// @notice Manages the Pool data and handles deposit and redemption operations.
contract SupplyManagerV2WithNative is SupplyManagerV2, ISupplyManagerV2WithNative {
    // ============ Constructor ============

    /// @notice Initializes the Supply Manager's contract.
    /// @param initialOwner Address of the contract's owner.
    /// @param yieldDistributorAddress Address authorized to distribute yield.
    /// @param moleculaPoolAddress Address of the Molecula Pool's contract.
    /// @param apy Initial APY formatter value.
    /// @param moleculaToken_ Molecula Token contract's address.
    /// @dev Sets up the initial state and validates parameters.
    constructor(
        address initialOwner,
        address yieldDistributorAddress,
        address moleculaPoolAddress,
        uint16 apy,
        address moleculaToken_
    )
        SupplyManagerV2(
            initialOwner,
            yieldDistributorAddress,
            moleculaPoolAddress,
            apy,
            moleculaToken_
        )
    {}

    // ============ Core Deposit/Withdrawal Functions ============

    /// @inheritdoc ISupplyManagerV2WithNative
    function depositNativeToken(
        address token,
        uint256 requestId,
        uint256 assets
    ) external payable virtual override onlyTokenVault returns (uint256 shares) {
        // Save the total supply value at the start of the operation.
        uint256 startTotalSupply = getTotalPoolSupply();

        // Call the Molecula Pool to deposit the assets.
        // slither-disable-next-line reentrancy-benign,reentrancy-eth
        uint256 moleculaTokenAssets = IMoleculaPoolV2WithNativeToken(_MOLECULA_POOL)
            .depositNativeToken{value: msg.value}(requestId, token, msg.sender, assets);

        shares = _updateDepositData(requestId, assets, startTotalSupply, moleculaTokenAssets);
    }

    /// @inheritdoc ISupplyManagerV2WithNative
    // solhint-disable-next-line gas-calldata-parameters
    function fulfillRedeemRequestsForNativeToken(
        uint256[] memory requestIds
    ) external virtual override only(_MOLECULA_POOL) returns (address asset, uint256 sumAssets) {
        // Get `TokenVault` and total native assets amount to fulfill from redeem requests.
        address tokenVault;
        (tokenVault, sumAssets) = _fulfillRedeemRequests(requestIds);

        // Get the native token associated with the `TokenVault`.
        asset = IERC7575(tokenVault).asset();
        if (asset != ConstantsCoreV2.NATIVE_TOKEN) {
            revert ENotNativeToken();
        }

        // Grant native assets to `TokenVault`.
        IMoleculaPoolV2WithNativeToken(msg.sender).grantNativeToken(tokenVault, sumAssets);

        // Process redeem requests fulfillment in `TokenVault`.
        INativeTokenVault(tokenVault).fulfillRedeemRequests(requestIds, sumAssets);

        emit RedeemRequestsFulfilled(requestIds, sumAssets);
    }
}
