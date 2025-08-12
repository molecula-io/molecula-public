// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @title ISupplyManagerV2.
/// @notice Interface for managing the Pool data and requests.
/// @dev Defines core functions for supply management and yield distribution.
interface ISupplyManagerV2 {
    // ============ Enums ============

    /// @dev Operation status.
    /// @param None No redemption request exists.
    /// @param Pending Redemption request is waiting to be fulfilled.
    /// @param Claimable Redemption request has been fulfilled and can be claimed.
    enum RequestState {
        None,
        Pending,
        Claimable
    }

    // ============ Structs ============

    /// @dev Information about a redeem operation.
    /// @param tokenVault `TokenVault` address associated with the operation.
    /// @param state Current state of the operation: `None`, `Pending`, or `Claimable`.
    /// @param controller Address of the controller associated with the request.
    /// @param owner Owner's address associated with the request.
    /// @param assets Amount of assets to be redeemed.
    /// @param shares Amount of shares to be burned.
    // solhint-disable-next-line gas-struct-packing
    struct RedeemRequestInfo {
        address tokenVault;
        RequestState state;
        address controller;
        address owner;
        uint256 assets;
        uint256 shares;
    }

    /// @dev Information about a party's yield distribution.
    /// @param user User's address.
    /// @param portion Yield portion.
    struct Party {
        address user;
        uint256 portion;
    }

    // ============ Events ============

    /// @dev Emitted when processing deposits.
    /// @param requestId Deposit operation's ID.
    /// @param tokenVault `TokenVault` address.
    /// @param assets Deposited amount.
    /// @param shares Shares amount to mint.
    event Deposit(
        uint256 indexed requestId,
        address indexed tokenVault,
        uint256 indexed assets,
        uint256 shares
    );

    /// @dev Emitted when a user processes a redemption.
    /// @param requestId Redemption operation's ID.
    /// @param tokenVault `TokenVault`'s address.
    /// @param value Redeemed value.
    /// @param shares Redeemed shares.
    event RedeemRequest(
        uint256 indexed requestId,
        address indexed tokenVault,
        uint256 indexed shares,
        uint256 value
    );

    /// @dev Emitted when redemption requests have been fulfilled and become claimable. This event
    ///      indicates that the requested redemptions are ready to be claimed by their respective owners.
    /// @param requestIds Array of request IDs that have been fulfilled.
    /// @param sumAssets Total sum of assets that have been processed for all fulfilled requests.
    event RedeemRequestsFulfilled(uint256[] requestIds, uint256 sumAssets);

    /// @dev Emitted when yield is distributed to parties in the Pool.
    /// @param distributedShares Total amount of shares distributed as yield.
    event YieldDistributed(uint256 indexed distributedShares);

    /// @dev Emitted when a new yield distributor is set.
    /// @param oldDistributor Address of the old yield distributor.
    /// @param newDistributor Address of the new yield distributor.
    event YieldDistributorChanged(address indexed oldDistributor, address indexed newDistributor);

    // ============ Errors ============

    /// @dev Error thrown when no shares are available.
    error ENoShares();

    /// @dev Error thrown when the share price is too low for the redemption.
    error ETooLowSharePrice();

    /// @dev Error thrown when the share price is too high for the redemption.
    error ETooHighSharePrice();

    /// @dev Error thrown when the caller is not an authorized `tokenVault`.
    error ENotMyAgent();

    /// @dev Error thrown when the wrong `TokenVault` is used.
    error EWrongTokenVault();

    /// @dev Error thrown when there are no pending redemption requests to process.
    error ENoPendingRequests();

    /// @dev Error thrown when the request is unknown: in the `None` status.
    error EUnknownRequest();

    /// @dev Error thrown when the sum of portions is not equal to `1`.
    error EWrongPortion();

    /// @dev Error thrown when the `TokenVault` already exists in the parties' list.
    error EDuplicateTokenVault();

    /// @dev Error thrown when the yield amount is negative.
    error ENoRealYield();

    /// @dev Error thrown when a native token operation is attempted on a non-native token function.
    error ENativeToken();

    // ============ Core Functions ============

    /// @dev Processes a deposit into the Pool.
    /// @param token Deposited token's ERC-20 address.
    /// @param requestId Deposit operation's ID.
    /// @param assets Deposit assets.
    /// @return shares Amount to mint.
    function deposit(
        address token,
        uint256 requestId,
        uint256 assets
    ) external returns (uint256 shares);

    /// @dev Requests a redemption operation from the Pool.
    ///      Creates a new redemption request that will be processed.
    /// @param token ERC20 token address for which redemption is requested.
    /// @param controller Address of the controller managing this redemption request.
    /// @param owner Address of the owner managing this redemption request.
    /// @param requestId Redemption request's ID.
    /// @param shares Amount of shares to be redeemed from the Pool.
    /// @return assets Estimated amount of assets to be received after the redemption.
    function requestRedeem(
        address token,
        address controller,
        address owner,
        uint256 requestId,
        uint256 shares
    ) external returns (uint256 assets);

    /// @dev Redeems the funds.
    /// @param assetOwner Address to redeem from.
    /// @param requestIds Redeem operations' IDs.
    /// @return asset Token ERC-20 address.
    /// @return redeemedAssets Redeemed assets.
    function fulfillRedeemRequests(
        address assetOwner,
        uint256[] calldata requestIds
    ) external returns (address asset, uint256 redeemedAssets);

    // ============ Admin Functions ============

    /// @dev Called when a token Vault is added.
    /// @param tokenVault Added token Vault's address.
    function onAddTokenVault(address tokenVault) external;

    /// @dev Called when a token Vault is removed.
    /// @param tokenVault Removed token Vault's address.
    function onRemoveTokenVault(address tokenVault) external;

    /**
     * @dev Distributes yield.
     * @param parties List of parties.
     * @param newApyFormatter New APY formatter.
     */
    function distributeYield(Party[] calldata parties, uint16 newApyFormatter) external;

    /**
     * @dev Setter for the Yield Distributor address.
     * @param newYieldDistributor New Yield Distributor address.
     */
    function setYieldDistributor(address newYieldDistributor) external;

    // ============ View Functions ============

    /// @dev Returns Molecula Token's address.
    /// @return moleculaTokenAddress Molecula Token's address.
    function moleculaToken() external view returns (address moleculaTokenAddress);

    /// @dev Returns information about a specific redeem request.
    /// @param requestID ID of the redeem request to query.
    /// @return tokenVault Address of the token Vault associated with the request.
    /// @return status Current state of the request: `None`, `Pending`, or `Claimable`.
    /// @return controller Address of the controller associated with the request.
    /// @return owner Address of the owner associated with the request.
    /// @return assets Amount of assets to be redeemed.
    /// @return shares Amount of shares to be burned.
    function redeemRequests(
        uint256 requestID
    )
        external
        view
        returns (
            address tokenVault,
            RequestState status,
            address controller,
            address owner,
            uint256 assets,
            uint256 shares
        );

    /// @dev Returns the Molecula Pool address.
    /// @return pool Molecula Pool address.
    function getMoleculaPool() external view returns (address pool);

    /// @dev Returns the total supply of the Pool (TVL). Reverts if some asset is depegged.
    /// @return pool Total pool supply.
    function getValidatedTotalPoolSupply() external view returns (uint256 pool);
}

/// @title ISupplyManagerV2WithNative.
/// @notice Interface for managing the native token redemption requests in the Supply Manager V2.
/// @dev Extends ISupplyManagerV2 with the native token support.
interface ISupplyManagerV2WithNative {
    /// @dev Error thrown when a non-native token operation is attempted on a native token function.
    error ENotNativeToken();

    /// @dev Processes a deposit into the Pool.
    /// @param token Deposited token's ERC20 address.
    /// @param requestId Deposit operation's ID.
    /// @param assets Deposit assets.
    /// @return shares Amount to mint.
    function depositNativeToken(
        address token,
        uint256 requestId,
        uint256 assets
    ) external payable returns (uint256 shares);

    /// @dev Fulfills redemption requests for the native token (e.g. ETH).
    /// @param requestIds Array of redemption request IDs to fulfill.
    /// @return asset Address of the native token.
    /// @return sumAssets Total amount of native tokens to be redeemed.
    function fulfillRedeemRequestsForNativeToken(
        uint256[] memory requestIds
    ) external returns (address asset, uint256 sumAssets);
}
