// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.30;

import {IERC7540Operator} from "../external/interfaces/IERC7540.sol";

contract ERC7540Operator is IERC7540Operator {
    // ============ State Variables ============

    /// @dev Checks whether an operator is approved by the controller.
    mapping(address controller => mapping(address operator => bool)) public isOperator;

    // ============ Errors ============

    /// @dev Thrown when an unauthorized address attempts to act as an operator.
    /// @param sender Address attempting to perform the operation.
    /// @param owner Owner of the assets.
    error EInvalidOperator(address sender, address owner);

    /// @dev Thrown when an address attempts to set itself as an operator.
    error ESelfOperator();

    // ============ Modifiers ============

    /// @dev Throws an error if a message sender is not the owner's operator.
    /// @param owner Owner of the assets or shares.
    modifier onlyOperator(address owner) {
        if (owner != msg.sender && !isOperator[owner][msg.sender]) {
            revert EInvalidOperator(msg.sender, owner);
        }
        _;
    }

    // ============ Core Functions ============

    /// @dev Approves or disapproves an operator for a controller.
    /// @param operator Corresponding operator.
    /// @param approved Approval status.
    /// @return result Approval result.
    function setOperator(
        address operator,
        bool approved
    ) external virtual override returns (bool result) {
        if (msg.sender == operator) {
            revert ESelfOperator();
        }
        isOperator[msg.sender][operator] = approved;
        emit OperatorSet(msg.sender, operator, approved);
        return true;
    }
}
