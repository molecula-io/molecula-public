// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

library LZMsgCodec {
    /// @dev Constant for requesting the deposit.
    uint8 internal constant REQUEST_DEPOSIT = 0x01;
    /// @dev Constant for confirming the deposit.
    uint8 internal constant CONFIRM_DEPOSIT = 0x02;
    /// @dev Constant for requesting the redeem operation.
    uint8 internal constant REQUEST_REDEEM = 0x03;
    /// @dev Constant for confirming the redeem operation.
    uint8 internal constant CONFIRM_REDEEM = 0x04;
    /// @dev Constant for distributing the yield.
    uint8 internal constant DISTRIBUTE_YIELD = 0x05;
    /// @dev Constant for confirming the deposit and updating the oracle data.
    uint8 internal constant CONFIRM_DEPOSIT_AND_UPDATE_ORACLE = 0x06;
    /// @dev Constant for distributing the yield and updating the oracle data.
    uint8 internal constant DISTRIBUTE_YIELD_AND_UPDATE_ORACLE = 0x07;
    /// @dev Constant for updating the oracle data.
    uint8 internal constant UPDATE_ORACLE = 0x08;

    /**
     * @dev Custom error for unknown message types.
     */
    error ELzUnknownMessage();

    /**
     * @dev Custom error for arrays length mismatch indication.
     */
    error EArraysLengthMismatch();

    /**
     * @dev Custom error for message length mismatch indication.
     */
    error EMalformedMessage();

    /**
     * @dev Decodes a message containing two uint256 values.
     * Applicable for messages of types:
     * - `REQUEST_DEPOSIT`.
     * - `CONFIRM_DEPOSIT`.
     * - `REQUEST_REDEEM`.
     * - `UPDATE_ORACLE`.
     * @param message Encoded message.
     * @return value1 First uint256 value in a pair.
     * @return value2 Second uint256 value in a pair.
     */
    function lzDecodeUint256Pair(
        bytes calldata message
    ) internal pure returns (uint256 value1, uint256 value2) {
        if (message.length != 64) revert EMalformedMessage();
        // slither-disable-next-line assembly, solhint-disable-next-line no-inline-assembly
        assembly {
            value1 := calldataload(add(message.offset, 0))
            value2 := calldataload(add(message.offset, 32))
        }
    }

    /**
     * @dev Encodes a request deposit message.
     * @param requestId Request ID.
     * @param value The value of the request.
     * @return message Encoded message.
     */
    function lzEncodeRequestDepositMessage(
        uint256 requestId,
        uint256 value
    ) internal pure returns (bytes memory message) {
        return abi.encodePacked(REQUEST_DEPOSIT, requestId, value);
    }

    /**
     * @dev Encodes a deposit confirmation message.
     * @param requestId Request ID.
     * @param shares Number of shares.
     * @return message Encoded message.
     */
    function lzEncodeConfirmDepositMessage(
        uint256 requestId,
        uint256 shares
    ) internal pure returns (bytes memory message) {
        return abi.encodePacked(CONFIRM_DEPOSIT, requestId, shares);
    }

    /**
     * @dev Encodes a deposit confirmation message and update the oracle.
     * @param requestId Request ID.
     * @param shares Number of shares.
     * @param totalValue Total value.
     * @param totalShares Total number of shares.
     * @return message Encoded message.
     */
    function lzEncodeConfirmDepositMessageAndUpdateOracle(
        uint256 requestId,
        uint256 shares,
        uint256 totalValue,
        uint256 totalShares
    ) internal pure returns (bytes memory message) {
        return
            abi.encodePacked(
                CONFIRM_DEPOSIT_AND_UPDATE_ORACLE,
                requestId,
                shares,
                totalValue,
                totalShares
            );
    }

    /**
     * @dev Decodes a deposit confirmation message and update the oracle.
     * @param message Encoded message.
     * @return requestId Decoded request ID.
     * @return shares Decoded shares.
     * @return totalValue Decoded total value.
     * @return totalShares Decoded total shares.
     */
    function lzDecodeConfirmDepositMessageAndUpdateOracle(
        bytes calldata message
    )
        internal
        pure
        returns (uint256 requestId, uint256 shares, uint256 totalValue, uint256 totalShares)
    {
        if (message.length != 128) revert EMalformedMessage();
        // slither-disable-next-line assembly, solhint-disable-next-line no-inline-assembly
        assembly {
            requestId := calldataload(add(message.offset, 0))
            shares := calldataload(add(message.offset, 32))
            totalValue := calldataload(add(message.offset, 64))
            totalShares := calldataload(add(message.offset, 96))
        }
    }

    /**
     * @dev Encodes a distribute yield message.
     * @param users The addresses of the users.
     * @param shares Number of shares.
     * @return message Encoded message.
     */
    function lzEncodeDistributeYieldMessage(
        address[] memory users,
        uint256[] memory shares
    ) internal pure returns (bytes memory message) {
        uint256 usersLen = users.length;
        if (usersLen != shares.length) revert EArraysLengthMismatch();

        message = new bytes(1 + usersLen * 20 + usersLen * 32);
        message[0] = bytes1(DISTRIBUTE_YIELD);
        // slither-disable-next-line assembly, solhint-disable-next-line no-inline-assembly
        assembly {
            let dataPtr := add(message, 32) // Pointer to the start of the message data.
            let offset := 1 // Skip the first byte that represents the message type.

            // Store users' addresses, each 20 bytes.
            for {
                let i := 0
            } lt(i, usersLen) {
                i := add(i, 1)
            } {
                let user := mload(add(users, add(32, mul(i, 32)))) // Load the user address.
                mstore(add(dataPtr, offset), shl(96, user)) // Store as `bytes20`, shifted 96 bits left.
                offset := add(offset, 20) // Move forward by 20 bytes.
            }

            // Store shares, each 32 bytes.
            for {
                let i := 0
            } lt(i, usersLen) {
                i := add(i, 1)
            } {
                let share := mload(add(shares, add(32, mul(i, 32)))) // Load the share value.
                mstore(add(dataPtr, offset), share) // Store as `uint256`.
                offset := add(offset, 32) // Move forward by 32 bytes.
            }
        }
    }

    /**
     * @dev Decodes a yield distribution message.
     * @param message Encoded message.
     * @return users Addresses of the users.
     * @return shares Number of shares.
     */
    function lzDecodeDistributeYieldMessage(
        bytes memory message
    ) internal pure returns (address[] memory users, uint256[] memory shares) {
        uint256 length = message.length;
        if (length % 52 != 0) revert EMalformedMessage();
        length = length / 52;
        users = new address[](length);
        shares = new uint256[](length);
        // slither-disable-next-line assembly, solhint-disable-next-line no-inline-assembly
        assembly {
            let dataPtr := add(message, 32) // Message already starts at `users[0]`.

            // Decode users, each stored as `bytes20`.
            for {
                let i := 0
            } lt(i, length) {
                i := add(i, 1)
            } {
                let userBytes := shr(96, mload(dataPtr)) // Extract last 20 bytes as an address.
                mstore(add(users, add(32, mul(i, 32))), userBytes) // Store in the users' array.
                dataPtr := add(dataPtr, 20) // Move forward by 20 bytes.
            }

            // Decode shares, each stored as `uint256`.
            for {
                let i := 0
            } lt(i, length) {
                i := add(i, 1)
            } {
                let share := mload(dataPtr) // Load the full 32-byte value.
                mstore(add(shares, add(32, mul(i, 32))), share) // Store in the shares' array.
                dataPtr := add(dataPtr, 32) // Move forward by 32 bytes.
            }
        }
    }

    /**
     * @dev Generates a default redeem operation confirmation message.
     * @param count Number of elements.
     * @return message Default encoded message.
     */
    function lzDefaultDistributeYieldMessage(
        uint256 count
    ) internal pure returns (bytes memory message) {
        address[] memory users = new address[](count);
        uint256[] memory shares = new uint256[](count);
        // slither-disable-next-line assembly, solhint-disable-next-line no-inline-assembly
        assembly {
            let usersPtr := add(users, 32) // Pointer to the first element in `users[]`.
            let sharesPtr := add(shares, 32) // Pointer to the first element in `shares[]`.
            let user := 1 // Predefine `address(1)` as `bytes20`.

            // Loop through the count and initialize users' and shares' arrays.
            for {
                let i := 0
            } lt(i, count) {
                i := add(i, 1)
            } {
                mstore(add(usersPtr, mul(i, 32)), user) // Store `address(1)` in `users[i]`.
                mstore(add(sharesPtr, mul(i, 32)), i) // Store `i` in `shares[i]`.
            }
        }

        return lzEncodeDistributeYieldMessage(users, shares);
    }

    /**
     * @dev Encodes a request redeem operation message.
     * @param requestId Request ID.
     * @param shares Number of shares.
     * @return message Encoded message.
     */
    function lzEncodeRequestRedeemMessage(
        uint256 requestId,
        uint256 shares
    ) internal pure returns (bytes memory message) {
        return abi.encodePacked(REQUEST_REDEEM, requestId, shares);
    }

    /**
     * @dev Encodes a redeem operation confirmation message.
     * @param requestIds The IDs of the requests.
     * @param values The values of the requests.
     * @return message Encoded message.
     */
    function lzEncodeConfirmRedeemMessage(
        uint256[] memory requestIds,
        uint256[] memory values
    ) internal pure returns (bytes memory message) {
        // slither-disable-next-line encode-packed-collision
        return abi.encodePacked(CONFIRM_REDEEM, requestIds, values);
    }

    /**
     * @dev Decodes a redeem operation confirmation message.
     * @param message Encoded message.
     * @return requestIds Decoded request IDs.
     * @return values Decoded values.
     */
    function lzDecodeConfirmRedeemMessage(
        bytes memory message
    ) internal pure returns (uint256[] memory requestIds, uint256[] memory values) {
        // Calculate the number of `uint256` elements in the message.
        uint256 length = message.length;
        if (length % 64 != 0) revert EMalformedMessage();
        // slither-disable-next-line divide-before-multiply
        length = length / 64;
        requestIds = new uint256[](length);
        values = new uint256[](length);
        // slither-disable-next-line assembly, solhint-disable-next-line no-inline-assembly
        assembly {
            let dataPtr := add(message, 32) // Start of the actual data.

            for {
                let i := 0
            } lt(i, length) {
                i := add(i, 1)
            } {
                let requestId := mload(dataPtr) // Load 32 bytes for the request ID.
                mstore(add(requestIds, add(32, mul(i, 32))), requestId) // Store in the `requestIds` array.
                dataPtr := add(dataPtr, 32) // Move to the next request ID.
            }

            for {
                let i := 0
            } lt(i, length) {
                i := add(i, 1)
            } {
                let value := mload(dataPtr) // Load 32 bytes for the value.
                mstore(add(values, add(32, mul(i, 32))), value) // Store in the values' array.
                dataPtr := add(dataPtr, 32) // Move to the next value.
            }
        }
    }

    /**
     * @dev Generates a default redeem operation confirmation message.
     * @param idsCount The number of request IDs.
     * @return message Default encoded message.
     */
    function lzDefaultConfirmRedeemMessage(
        uint256 idsCount
    ) internal pure returns (bytes memory message) {
        uint256[] memory requestId = new uint256[](idsCount);
        uint256[] memory values = new uint256[](idsCount);
        // slither-disable-next-line assembly, solhint-disable-next-line no-inline-assembly
        assembly {
            let requestIdPtr := add(requestId, 32) // Pointer to the first element in `requestId[]`.
            let valuesPtr := add(values, 32) // Pointer to the first element in `values[]`.

            for {
                let i := 0
            } lt(i, idsCount) {
                i := add(i, 1)
            } {
                mstore(add(requestIdPtr, mul(i, 32)), i) // Store `i` at `requestId[i]`.
                mstore(add(valuesPtr, mul(i, 32)), i) // Store `i` at `values[i]`.
            }
        }

        return lzEncodeConfirmRedeemMessage(requestId, values);
    }

    /**
     * @dev Encodes a distribute yield message and update the oracle.
     * @param users The addresses of the users.
     * @param shares Number of shares.
     * @param totalValue Total value.
     * @param totalShares Total shares.
     * @return message Encoded message.
     */
    function lzEncodeDistributeYieldMessageAndUpdateOracle(
        address[] memory users,
        uint256[] memory shares,
        uint256 totalValue,
        uint256 totalShares
    ) internal pure returns (bytes memory message) {
        uint256 usersLen = users.length;
        if (usersLen != shares.length) revert EArraysLengthMismatch();

        message = new bytes(1 + 32 + 32 + usersLen * 20 + usersLen * 32);
        message[0] = bytes1(DISTRIBUTE_YIELD_AND_UPDATE_ORACLE);
        // slither-disable-next-line assembly, solhint-disable-next-line no-inline-assembly
        assembly {
            let offset := 1 // Skip the message type byte.
            let dataPtr := add(message, 32)

            // Store totalValue and totalShares
            mstore(add(dataPtr, offset), totalValue)
            offset := add(offset, 32)
            mstore(add(dataPtr, offset), totalShares)
            offset := add(offset, 32)

            for {
                let i := 0
            } lt(i, usersLen) {
                i := add(i, 1)
            } {
                let user := mload(add(users, add(32, mul(i, 32))))
                mstore(add(dataPtr, offset), shl(96, user))
                offset := add(offset, 20)
            }

            for {
                let i := 0
            } lt(i, usersLen) {
                i := add(i, 1)
            } {
                let share := mload(add(shares, add(32, mul(i, 32))))
                mstore(add(dataPtr, offset), share)
                offset := add(offset, 32)
            }
        }
    }

    /**
     * @dev Decodes a yield distribution message and update the oracle.
     * @param message Encoded message.
     * @return users Addresses of the users.
     * @return shares Number of shares.
     * @return totalValue Total value.
     * @return totalShares Total shares.
     */
    function lzDecodeDistributeYieldMessageAndUpdateOracle(
        bytes memory message
    )
        internal
        pure
        returns (
            address[] memory users,
            uint256[] memory shares,
            uint256 totalValue,
            uint256 totalShares
        )
    {
        uint256 numUsers = (message.length - 64) / 52;

        users = new address[](numUsers);
        shares = new uint256[](numUsers);
        // slither-disable-next-line assembly, solhint-disable-next-line no-inline-assembly
        assembly {
            let dataPtr := add(message, 32)
            totalValue := mload(dataPtr)
            totalShares := mload(add(dataPtr, 32))
            dataPtr := add(dataPtr, 64)

            for {
                let i := 0
            } lt(i, numUsers) {
                i := add(i, 1)
            } {
                let userBytes := shr(96, mload(dataPtr))
                mstore(add(users, add(32, mul(i, 32))), userBytes)
                dataPtr := add(dataPtr, 20)
            }

            for {
                let i := 0
            } lt(i, numUsers) {
                i := add(i, 1)
            } {
                let share := mload(dataPtr)
                mstore(add(shares, add(32, mul(i, 32))), share)
                dataPtr := add(dataPtr, 32)
            }
        }
    }

    /**
     * @dev Generates a default redeem operation confirmation message and update the oracle.
     * @param count Number of elements.
     * @return message Default encoded message.
     */
    function lzDefaultDistributeYieldMessageAndUpdateOracle(
        uint256 count
    ) internal pure returns (bytes memory message) {
        address[] memory users = new address[](count);
        uint256[] memory shares = new uint256[](count);
        // slither-disable-next-line assembly, solhint-disable-next-line no-inline-assembly
        assembly {
            let usersPtr := add(users, 32) // Get the pointer to the first element in `users[]`.
            let sharesPtr := add(shares, 32) // Get the pointer to the first element in `shares[]`.
            let user := 1 // Address `0x0000000000000000000000000000000000000001`.

            for {
                let i := 0
            } lt(i, count) {
                i := add(i, 1)
            } {
                mstore(add(usersPtr, mul(i, 32)), user) // Store `address(1)` at `users[i]`.
                mstore(add(sharesPtr, mul(i, 32)), i) // Store `i` at `shares[i]`.
            }
        }

        return lzEncodeDistributeYieldMessageAndUpdateOracle(users, shares, 1, 2);
    }

    /**
     * @dev Encodes an oracle update message.
     * @param totalValue Total value.
     * @param totalShares Total shares.
     * @return message Encoded message.
     */
    function lzEncodeUpdateOracle(
        uint256 totalValue,
        uint256 totalShares
    ) internal pure returns (bytes memory message) {
        return abi.encodePacked(UPDATE_ORACLE, totalValue, totalShares);
    }
}
