// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.23;

import {LZMsgCodec} from "../../common/layerzero/LZMsgCodec.sol";

/// @notice A combined wrapper contract to expose LZMsgCodec encoding and decoding functions for testing.
contract MockLZMessageDecoder {
    // ============================
    //          DECODING
    // ============================

    /**
     * @notice Decodes a request deposit message.
     * @param message The full encoded message.
     * @return requestId The decoded request ID.
     * @return value The decoded value.
     */
    function decodeRequestDepositMessage(
        bytes calldata message
    ) external pure returns (uint256 requestId, uint256 value) {
        return LZMsgCodec.lzDecodeUint256Pair(message[1:]);
    }

    /**
     * @notice Decodes a deposit confirmation message.
     * @param message The full encoded message.
     * @return requestId The decoded request ID.
     * @return shares The decoded number of shares.
     */
    function decodeConfirmDepositMessage(
        bytes calldata message
    ) external pure returns (uint256 requestId, uint256 shares) {
        return LZMsgCodec.lzDecodeUint256Pair(message[1:]);
    }

    /**
     * @notice Decodes an oracle update message.
     * @param message The full encoded message.
     * @return totalValue The decoded total value.
     * @return totalShares The decoded total shares.
     */
    function decodeUpdateOracle(
        bytes calldata message
    ) external pure returns (uint256 totalValue, uint256 totalShares) {
        return LZMsgCodec.lzDecodeUint256Pair(message[1:]);
    }

    /**
     * @notice Decodes a deposit confirmation message with oracle update.
     * @param message The full encoded message.
     * @return requestId The decoded request ID.
     * @return shares The decoded number of shares.
     * @return totalValue The decoded total value.
     * @return totalShares The decoded total shares.
     */
    function decodeConfirmDepositMessageAndUpdateOracle(
        bytes calldata message
    )
        external
        pure
        returns (uint256 requestId, uint256 shares, uint256 totalValue, uint256 totalShares)
    {
        return LZMsgCodec.lzDecodeConfirmDepositMessageAndUpdateOracle(message[1:]);
    }

    /**
     * @notice Decodes a request redeem message.
     * @param message The full encoded message.
     * @return requestId The decoded request ID.
     * @return shares The decoded value.
     */
    function decodeRequestRedeemMessage(
        bytes calldata message
    ) external pure returns (uint256 requestId, uint256 shares) {
        return LZMsgCodec.lzDecodeUint256Pair(message[1:]);
    }

    /**
     * @notice Decodes a confirm redeem message.
     * @param message The encoded message.
     * @return requestIds An array of decoded request IDs.
     * @return values An array of decoded values.
     */
    function decodeConfirmRedeemMessage(
        bytes calldata message
    ) external pure returns (uint256[] memory requestIds, uint256[] memory values) {
        return LZMsgCodec.lzDecodeConfirmRedeemMessage(message[1:]);
    }

    /**
     * @notice Decodes a yield distribution message.
     * @dev Assumes the message does not include a type byte at the beginning.
     * @param message The encoded message.
     * @return users An array of user addresses.
     * @return shares An array of shares corresponding to the users.
     */
    function decodeDistributeYieldMessage(
        bytes calldata message
    ) external pure returns (address[] memory users, uint256[] memory shares) {
        return LZMsgCodec.lzDecodeDistributeYieldMessage(message[1:]);
    }

    /**
     * @notice Decodes a yield distribution message with oracle update.
     * @param message The encoded message.
     * @return users An array of user addresses.
     * @return shares An array of shares corresponding to the users.
     * @return totalValue The decoded total value.
     * @return totalShares The decoded total shares.
     */
    function decodeDistributeYieldMessageAndUpdateOracle(
        bytes calldata message
    )
        external
        pure
        returns (
            address[] memory users,
            uint256[] memory shares,
            uint256 totalValue,
            uint256 totalShares
        )
    {
        return LZMsgCodec.lzDecodeDistributeYieldMessageAndUpdateOracle(message[1:]);
    }

    // ============================
    //           ENCODING
    // ============================

    /**
     * @notice Encodes a request deposit message.
     * @param requestId The request ID.
     * @param value The deposit value.
     * @return message The full encoded message.
     */
    function encodeRequestDepositMessage(
        uint256 requestId,
        uint256 value
    ) external pure returns (bytes memory message) {
        return LZMsgCodec.lzEncodeRequestDepositMessage(requestId, value);
    }

    /**
     * @notice Encodes a confirm deposit message.
     * @param requestId The request ID.
     * @param shares The number of shares.
     * @return message The full encoded message.
     */
    function encodeConfirmDepositMessage(
        uint256 requestId,
        uint256 shares
    ) external pure returns (bytes memory message) {
        return LZMsgCodec.lzEncodeConfirmDepositMessage(requestId, shares);
    }

    /**
     * @notice Encodes a confirm deposit message with oracle update.
     * @param requestId The request ID.
     * @param shares The number of shares.
     * @param totalValue The total value.
     * @param totalShares The total shares.
     * @return message The full encoded message.
     */
    function encodeConfirmDepositMessageAndUpdateOracle(
        uint256 requestId,
        uint256 shares,
        uint256 totalValue,
        uint256 totalShares
    ) external pure returns (bytes memory message) {
        return
            LZMsgCodec.lzEncodeConfirmDepositMessageAndUpdateOracle(
                requestId,
                shares,
                totalValue,
                totalShares
            );
    }

    /**
     * @notice Encodes a request redeem message.
     * @param requestId The request ID.
     * @param shares The number of shares.
     * @return message The full encoded message.
     */
    function encodeRequestRedeemMessage(
        uint256 requestId,
        uint256 shares
    ) external pure returns (bytes memory message) {
        return LZMsgCodec.lzEncodeRequestRedeemMessage(requestId, shares);
    }

    /**
     * @notice Encodes a confirm redeem message.
     * @param requestIds An array of request IDs.
     * @param values An array of values.
     * @return message The full encoded message.
     */
    function encodeConfirmRedeemMessage(
        uint256[] calldata requestIds,
        uint256[] calldata values
    ) external pure returns (bytes memory message) {
        return LZMsgCodec.lzEncodeConfirmRedeemMessage(requestIds, values);
    }

    /**
     * @notice Encodes a yield distribution message.
     * @param users An array of user addresses.
     * @param shares An array of shares corresponding to the users.
     * @return message The full encoded message.
     */
    function encodeDistributeYieldMessage(
        address[] calldata users,
        uint256[] calldata shares
    ) external pure returns (bytes memory message) {
        return LZMsgCodec.lzEncodeDistributeYieldMessage(users, shares);
    }

    /**
     * @notice Encodes a yield distribution message with oracle update.
     * @param users An array of user addresses.
     * @param shares An array of shares corresponding to the users.
     * @param totalValue The total value.
     * @param totalShares The total shares.
     * @return message The full encoded message.
     */
    function encodeDistributeYieldMessageAndUpdateOracle(
        address[] calldata users,
        uint256[] calldata shares,
        uint256 totalValue,
        uint256 totalShares
    ) external pure returns (bytes memory message) {
        return
            LZMsgCodec.lzEncodeDistributeYieldMessageAndUpdateOracle(
                users,
                shares,
                totalValue,
                totalShares
            );
    }

    /**
     * @notice Encodes an oracle update message.
     * @param totalValue The total value.
     * @param totalShares The total shares.
     * @return message The full encoded message.
     */
    function encodeUpdateOracle(
        uint256 totalValue,
        uint256 totalShares
    ) external pure returns (bytes memory message) {
        return LZMsgCodec.lzEncodeUpdateOracle(totalValue, totalShares);
    }

    // ============================
    //           DEFAULT
    // ============================

    /**
     * @notice Generates a default confirm redeem message.
     * @param idsCount The number of request IDs.
     * @return message The full encoded default message.
     */
    function defaultConfirmRedeemMessage(
        uint256 idsCount
    ) external pure returns (bytes memory message) {
        return LZMsgCodec.lzDefaultConfirmRedeemMessage(idsCount);
    }

    /**
     * @notice Generates a default yield distribution message.
     * @param count The number of yield entries.
     * @return message The full encoded default message.
     */
    function defaultDistributeYieldMessage(
        uint256 count
    ) external pure returns (bytes memory message) {
        return LZMsgCodec.lzDefaultDistributeYieldMessage(count);
    }

    /**
     * @notice Generates a default yield distribution message with oracle update.
     * @param count The number of yield entries.
     * @return message The full encoded default message.
     */
    function defaultDistributeYieldMessageAndUpdateOracle(
        uint256 count
    ) external pure returns (bytes memory message) {
        return LZMsgCodec.lzDefaultDistributeYieldMessageAndUpdateOracle(count);
    }
}
