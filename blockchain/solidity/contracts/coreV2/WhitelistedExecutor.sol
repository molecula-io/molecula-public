// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.30;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {ValueValidator} from "./../common/ValueValidator.sol";
import {IWhitelistedExecutor} from "./interfaces/IWhitelistedExecutor.sol";

/// @title WhitelistedExecutor.
abstract contract WhitelistedExecutor is Ownable, IWhitelistedExecutor, ValueValidator {
    using Address for address;
    using Address for address payable;

    // ============ State Variables ============

    /// @dev Whitelist of addresses callable by this contract.
    mapping(address target => mapping(bytes4 selector => bool isAllowed))
        public isWhitelistedSignature;

    /// @dev Whitelist of addresses callable by this contract.
    mapping(address spender => bool isAllowed) public isWhitelistedSpender;

    /// @dev Initializes the contract setting the initializer address.
    /// @param whiteList List of whitelisted addresses.
    constructor(WhiteList[] memory whiteList) {
        uint256 whiteListLength = whiteList.length;
        for (uint256 i = 0; i < whiteListLength; ++i) {
            _addInWhiteList(whiteList[i].target, whiteList[i].selector);
        }
    }

    // ============ Core Functions ============

    /// @inheritdoc IWhitelistedExecutor
    function setSpenderInWhiteList(
        address spender,
        bool isAllowed
    ) external virtual override notZeroAddress(spender) onlyOwner {
        if (isWhitelistedSpender[spender] == isAllowed) {
            revert ESpenderIsAlreadySet();
        }
        isWhitelistedSpender[spender] = isAllowed;
        emit SpenderSetInWhiteList(spender, isAllowed);
    }

    /// @inheritdoc IWhitelistedExecutor
    function addInWhiteList(address target, bytes4 selector) external virtual override onlyOwner {
        _addInWhiteList(target, selector);
        emit AddedInWhiteList(target, selector);
    }

    /// @inheritdoc IWhitelistedExecutor
    function deleteFromWhiteList(
        address target,
        bytes4 selector
    ) external virtual override onlyOwner {
        if (!isWhitelistedSignature[target][selector]) {
            revert ENotPresentInWhiteList();
        }
        delete isWhitelistedSignature[target][selector];
        emit DeletedFromWhiteList(target, selector);
    }

    // ============ Internal Functions ============

    /// @dev Add the target in the whitelist.
    /// @param target Address.
    /// @param selector Function selector.
    function _addInWhiteList(
        address target,
        bytes4 selector
    ) internal virtual notZeroAddress(target) {
        if (isWhitelistedSignature[target][selector]) {
            revert EAlreadyAddedInWhiteList();
        }
        isWhitelistedSignature[target][selector] = true;
    }

    /// @dev Execute transactions on behalf of the whitelisted contract.
    ///      Allows the `approve` calls to tokens in `poolMap` and `poolMap` without whitelisting.
    /// @param target Address.
    /// @param data Encoded function data.
    /// @param value Value to attach.
    /// @return result Result of the function call.
    function _execute(
        address target,
        bytes calldata data,
        uint256 value
    ) internal virtual returns (bytes memory result) {
        // Decode the function selector.
        bytes4 selector = bytes4(data);

        // Handle approve operations with an enhanced validation.
        if (selector == IERC20.approve.selector) {
            return _executeApprove(target, data, value);
        }

        // Handle all other operations with a standard whitelist check.
        if (!isWhitelistedSignature[target][selector]) {
            revert ENotPresentInWhiteList();
        }

        // Execute the function call.
        return target.functionCallWithValue(data, value);
    }

    /// @dev Execute approve operations with enhanced validation.
    /// @param target Address.
    /// @param data Encoded function data.
    /// @param value Value to attach.
    /// @return result Result of the function call.
    function _executeApprove(
        address target,
        bytes calldata data,
        uint256 value
    ) internal virtual returns (bytes memory result) {
        // Check if the target is internally approved or explicitly whitelisted for the approve operations.
        if (
            !_isAllowedForApprove(target) &&
            !isWhitelistedSignature[target][IERC20.approve.selector]
        ) {
            revert EApproveIsNotAllowed();
        }

        // Ensure that the value is zero for the approve operations.
        if (value != 0) {
            revert EMsgValueIsNotZero();
        }

        // Decode `approve(spender, amount)` to get the spender's address.
        address spender;
        // slither-disable-next-line assembly, solhint-disable-next-line no-inline-assembly
        assembly {
            spender := calldataload(add(data.offset, 4)) // Skip: 4 bytes selector.
        }

        // Ensure that the spender is whitelisted.
        if (!isWhitelistedSpender[spender]) {
            revert ENotInWhiteListSpender();
        }

        // Execute the function call.
        return target.functionCall(data);
    }

    /// @dev Checks if `target` is allowed for approval.
    /// @param target Address.
    /// @return isAllowed Boolean flag: `true` if `token` is is allowed for approval. Otherwise, `false`.
    function _isAllowedForApprove(address target) internal virtual returns (bool isAllowed);
}
