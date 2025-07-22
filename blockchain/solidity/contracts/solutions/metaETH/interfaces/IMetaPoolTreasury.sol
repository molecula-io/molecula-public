// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

interface IMetaPoolTreasury {
    // ============ Structs ============
    /**
     * @dev Token information.
     * @param isPresent Is token present.
     * @param isBlocked Boolean flag indicating whether the token is blocked
     *                  for execution and fulfilling redemption requests.
     * @param arrayIndex Index in `TokenParams[] pool`.
     * @param requestedRedeemAssets Value to redeem in the token amount.
     */
    struct TokenInfo {
        bool isPresent;
        bool isBlocked;
        uint32 arrayIndex;
        uint256 requestedRedeemAssets;
    }

    /**
     * @dev Parameters of execute function
     * @param target Target's address.
     * @param data Encoded function data.
     * @param value Value to attach.
     */
    struct ExecuteParams {
        address target;
        bytes data;
        uint256 value;
    }

    // ============ Errors ============

    /// @dev Error: Block status is already set.
    error EAlreadyBlockedSet();

    /// @dev Error: Duplicated token.
    error EDuplicatedToken();

    /// @dev Error: Removed token does not have the zero `valueToRedeem` value.
    error ENotZeroValueToRedeemOfRemovedToken();

    /// @dev Error: Molecula Pool does not have the token.
    error ETokenNotExist();

    /// @dev Error: The `redeem` or `execute` function with the blocked token is called.
    error ETokenBlocked();

    /// @dev Error: Target address is not in the whitelist.
    error ENotInWhiteList();

    /// @dev Error: Target address has already been added.
    error EAlreadyAddedInWhiteList();

    /// @dev Error: Target address is not in the whitelist.
    error ENotPresentInWhiteList();

    /// @dev Error: Wrong attached message value.
    error EWrongMsgValue();

    // ============ Events ============

    /// @dev Emitted when the target has been added in the whitelist.
    /// @param target Address.
    event AddedInWhiteList(address indexed target);

    /// @dev Emitted when the target has been deleted from the whitelist.
    /// @param target Address.
    event DeletedFromWhiteList(address indexed target);

    /// @dev Emitted when `token` is blocked or unblocked.
    /// @param token Token address.
    /// @param isBlocked New token status.
    event TokenBlockedChanged(address indexed token, bool indexed isBlocked);

    /// @dev Emitted when `execute` function is  blocked or unblocked.
    /// @param result Result of the function calls.
    event Executed(bytes[] result);

    /// @dev Emitted when ETH transfer failed.
    /// @param returnData Error data returned from the failed transfer.
    event EthTransferFailed(bytes returnData);

    // ============ Functions ============

    /// @dev Fulfills redemption requests for the specified request IDs.
    /// @param requestIds Array of redemption request IDs.
    function fulfillRedeemRequests(uint256[] calldata requestIds) external;

    /// @dev Fulfills redemption requests for the specified request IDs.
    /// @param requestIds Array of redemption request IDs.
    function fulfillRedeemRequestsForNativeToken(uint256[] calldata requestIds) external;

    /**
     * @dev Add the token to the Pool.
     * @param token ERC20 token address.
     */
    function addToken(address token) external;

    /**
     * @dev Delete the token from the Pool.
     * @param token Token address.
     */
    function removeToken(address token) external;

    /**
     * @dev Sets the Pool Keeper's wallet.
     * @param poolKeeperAddress Pool Keeper's wallet.
     */
    function setPoolKeeper(address poolKeeperAddress) external;

    /// @dev Block & unblock the `execute` and `redeem` operations with the token from the Pool.
    /// @param token Token address.
    /// @param isBlocked Boolean flag indicating whether the token is blocked.
    function setBlockToken(address token, bool isBlocked) external;

    /**
     * @dev Add the target in the whitelist.
     * @param target Address.
     */
    function addInWhiteList(address target) external;

    /**
     * @dev Delete the target from the whitelist.
     * @param target Address.
     */
    function deleteFromWhiteList(address target) external;

    /**
     * @dev Execute transactions on behalf of the whitelisted contract.
     * Allows the `approve` calls to tokens in `poolMap` and `poolMap` without whitelisting.
     * @param params Parameters of the function calls.
     * @return result Result of the function calls.
     */
    function execute(
        ExecuteParams[] calldata params
    ) external payable returns (bytes[] memory result);

    /**
     * @dev Returns the total supply of the pool (TVL).
     * @return supply Total pool supply.
     * @return totalRedeem Total redeem value.
     */
    function totalPoolsSupplyAndRedeem()
        external
        view
        returns (uint256 supply, uint256 totalRedeem);

    /**
     * @dev Returns the list of the ERC20 Pool.
     * @return result List of the ERC20 Pool.
     */
    function getTokenPool() external view returns (address[] memory result);
}
