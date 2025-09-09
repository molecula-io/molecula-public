// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IOperationsType} from "../interfaces/IOperationsType.sol";

/**
 * @title OperationsType.
 * @dev Contract for managing operation types.
 */
contract OperationsType is IOperationsType {
    /// @dev Mapping to store operation types for each request ID.
    mapping(uint256 requestId => OperationType) internal _operationsType;

    /**
     * @dev Sets the operation type for a specific request ID.
     * @param requestId Request ID to set an operation type for.
     * @param operationType Operation type to set.
     */
    function _setOperationType(uint256 requestId, OperationType operationType) internal {
        _operationsType[requestId] = operationType;
        emit OperationTypeSet(requestId, operationType);
    }

    /**
     * @dev Gets the operation type for a specific request ID.
     * @param requestId Request ID to get an operation type for.
     * @return Operation type.
     */
    function getOperationType(uint256 requestId) external view returns (OperationType) {
        return _operationsType[requestId];
    }
}
