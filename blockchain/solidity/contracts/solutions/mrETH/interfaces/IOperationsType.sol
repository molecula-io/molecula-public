// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IOperationsType.
 * @dev Interface for OperationsType contract
 */
interface IOperationsType {
    /**
     * @dev Defines the type of the redeem operation.
     * @param RedeemFromEigenLayer Operation for the redemption from EigenLayer.
     * @param RedeemFromBuffer Operation for the redemption from the Buffer.
     */
    enum OperationType {
        RedeemFromEigenLayer,
        RedeemFromBuffer
    }

    /// @dev Event emitted when an operation type is set.
    /// @param requestId Request ID.
    /// @param operationType Redemption operation type.
    event OperationTypeSet(uint256 indexed requestId, OperationType operationType);

    /**
     * @dev Gets the operation type for a specific request ID.
     * @param requestId Request ID to get an operation type for.
     * @return Operation type.
     */
    function getOperationType(uint256 requestId) external view returns (OperationType);
}
