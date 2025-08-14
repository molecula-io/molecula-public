// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.30;

/// @title IWhitelistedExecutor
interface IWhitelistedExecutor {
    // ============ Structs ============

    /// @dev Whitelist containing the contract's address and function selector.
    /// @param target Contract's address.
    /// @param selector Function selector.
    struct WhiteList {
        address target;
        bytes4 selector;
    }

    // ============ Errors ============

    /// @dev Error: Spender is not in the whitelist.
    error ENotInWhiteListSpender();

    /// @dev Error: Target address and selector have already been added.
    error EAlreadyAddedInWhiteList();

    /// @dev Error: Target address and selector are not in the whitelist.
    error ENotPresentInWhiteList();

    /// @dev Error: Spender has already been added or deleted.
    error ESpenderIsAlreadySet();

    /// @dev Error: Selector approval is not allowed.
    error EApproveIsNotAllowed();

    // ============ Events ============

    /// @dev Emitted when a spender is added to or removed from the whitelist.
    /// @param spender Spender's address. See the `IERC20.approve` function.
    /// @param isAllowed Boolean flag indicating whether the spender is allowed.
    event SpenderSetInWhiteList(address indexed spender, bool indexed isAllowed);

    /// @dev Emitted when the target has been added in the whitelist.
    /// @param target Address.
    /// @param selector Function selector.
    event AddedInWhiteList(address indexed target, bytes4 selector);

    /// @dev Emitted when the target has been deleted from the whitelist.
    /// @param target Address.
    /// @param selector Function selector.
    event DeletedFromWhiteList(address indexed target, bytes4 selector);

    // ============ Core Functions ============

    /// @dev Add or delete the spender from whitelist.
    /// @param spender Spender's address. See the `IERC20.approve` function.
    /// @param isAllowed Boolean flag indicating whether the spender is allowed.
    function setSpenderInWhiteList(address spender, bool isAllowed) external;

    /// @dev Add the target and selector to the whitelist.
    /// @param target Address.
    /// @param selector Function selector.
    function addInWhiteList(address target, bytes4 selector) external;

    /// @dev Delete the target and selector from the whitelist.
    /// @param target Address.
    /// @param selector Function selector.
    function deleteFromWhiteList(address target, bytes4 selector) external;
}
