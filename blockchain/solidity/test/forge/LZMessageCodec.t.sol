// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.23;

import "forge-std/Test.sol";
import {LZMsgCodec} from "../../contracts/common/layerzero/LZMsgCodec.sol";
import {MockLZMessageDecoder} from "../../contracts/mock/MockLZMessageDecoder.sol";

/// @title LZMsgCodecTest
/// @notice This test contract validates the encoding and decoding functions
/// provided by the LZMsgCodec via a mock decoder, ensuring that messages are
/// correctly serialized and deserialized.
contract LZMsgCodecTest is Test {
    // Instance of the mock decoder that uses LZMsgCodec for encoding/decoding.
    MockLZMessageDecoder _codec;

    /// @notice setUp deploys a new instance of the mock decoder.
    function setUp() public {
        _codec = new MockLZMessageDecoder();
    }

    /// @notice Tests encoding and decoding of a request deposit message.
    /// @param requestId Unique identifier for the deposit request.
    /// @param value The deposit amount.
    function testFuzz_EncodeDecodeRequestDeposit(uint256 requestId, uint256 value) public view {
        // Encode the message; the first byte indicates the message type.
        bytes memory encoded = _codec.encodeRequestDepositMessage(requestId, value);

        // Verify the encoded message length: 1 byte for the message type + 32 bytes each for requestId and value.
        assertEq(encoded.length, 65);
        // Verify that the message type byte is correctly set as REQUEST_DEPOSIT.
        assertEq(uint8(encoded[0]), LZMsgCodec.REQUEST_DEPOSIT);

        // Decode the message and extract the requestId and value.
        (uint256 decodedRequestId, uint256 decodedValue) = _codec.decodeRequestDepositMessage(
            encoded
        );
        // Ensure that the decoded values match the original input.
        assertEq(decodedRequestId, requestId);
        assertEq(decodedValue, value);
    }

    /// @notice Tests encoding and decoding of a confirm deposit message.
    /// @param requestId Unique identifier for the deposit request.
    /// @param value The deposit amount confirmed.
    function testFuzz_EncodeDecodeConfirmDeposit(uint256 requestId, uint256 value) public view {
        // Encode the confirm deposit message.
        bytes memory encoded = _codec.encodeConfirmDepositMessage(requestId, value);

        // Verify the expected length and that the header byte matches CONFIRM_DEPOSIT.
        assertEq(encoded.length, 65);
        assertEq(uint8(encoded[0]), LZMsgCodec.CONFIRM_DEPOSIT);

        // Decode the message.
        (uint256 decodedRequestId, uint256 decodedValue) = _codec.decodeConfirmDepositMessage(
            encoded
        );
        // Ensure decoding recovers the correct values.
        assertEq(decodedRequestId, requestId);
        assertEq(decodedValue, value);
    }

    /// @notice Tests encoding and decoding of a request redeem message.
    /// @param requestId Unique identifier for the redeem request.
    /// @param shares The number of shares to be redeemed.
    function testFuzz_EncodeDecodeRequestRedeem(uint256 requestId, uint256 shares) public view {
        // Encode a request redeem message.
        bytes memory encoded = _codec.encodeRequestRedeemMessage(requestId, shares);

        // Verify the encoded message is 65 bytes and has the correct header.
        assertEq(encoded.length, 65);
        assertEq(uint8(encoded[0]), LZMsgCodec.REQUEST_REDEEM);

        // Decode the message.
        (uint256 decodedRequestId, uint256 decodedValue) = _codec.decodeRequestRedeemMessage(
            encoded
        );
        // Confirm that the decoded requestId and value match the inputs.
        assertEq(decodedRequestId, requestId);
        assertEq(decodedValue, shares);
    }

    /// @notice Tests encoding and decoding of an update oracle message.
    /// @param totalValue The total value from the oracle.
    /// @param totalShares The total shares from the oracle.
    function testFuzz_EncodeDecodeUpdateOracle(
        uint256 totalValue,
        uint256 totalShares
    ) public view {
        // Encode the update oracle message.
        bytes memory encoded = _codec.encodeUpdateOracle(totalValue, totalShares);

        // Validate the message length and header for UPDATE_ORACLE.
        assertEq(encoded.length, 65);
        assertEq(uint8(encoded[0]), LZMsgCodec.UPDATE_ORACLE);

        // Decode the message.
        (uint256 decodedTotalValue, uint256 decodedTotalShares) = _codec.decodeUpdateOracle(
            encoded
        );
        // Assert that the decoded values match the input parameters.
        assertEq(decodedTotalValue, totalValue);
        assertEq(decodedTotalShares, totalShares);
    }

    /// @notice Tests encoding and decoding of a confirm deposit message that also updates the oracle.
    /// @param requestId Unique identifier for the deposit request.
    /// @param shares The number of shares in the deposit.
    /// @param totalValue The updated total value from the oracle.
    /// @param totalShares The updated total shares from the oracle.
    function testFuzz_EncodeDecodeConfirmDepositMessageAndUpdateOracle(
        uint256 requestId,
        uint256 shares,
        uint256 totalValue,
        uint256 totalShares
    ) public view {
        // Encode the combined confirm deposit and oracle update message.
        bytes memory encoded = _codec.encodeConfirmDepositMessageAndUpdateOracle(
            requestId,
            shares,
            totalValue,
            totalShares
        );

        // Expect the message length to be 129 bytes (header + 4 * 32 bytes).
        assertEq(encoded.length, 129);
        // Check that the header byte is set as CONFIRM_DEPOSIT_AND_UPDATE_ORACLE.
        assertEq(uint8(encoded[0]), LZMsgCodec.CONFIRM_DEPOSIT_AND_UPDATE_ORACLE);
        {
            // Decode the message.
            (
                uint256 decodedRequestId,
                uint256 decodedShares,
                uint256 decodedTotalValue,
                uint256 decodedTotalShares
            ) = _codec.decodeConfirmDepositMessageAndUpdateOracle(encoded);

            // Verify that each decoded value matches its original input.
            assertEq(decodedRequestId, requestId);
            assertEq(decodedShares, shares);
            assertEq(decodedTotalValue, totalValue);
            assertEq(decodedTotalShares, totalShares);
        }
    }

    /// @notice Tests encoding and decoding of a yield distribution message.
    function test_EncodeDecodeDistributeYieldMessage() public view {
        // Set up test arrays with 3 entries.
        address[] memory users = new address[](3);
        uint256[] memory shares = new uint256[](3);

        users[0] = vm.addr(1);
        users[1] = vm.addr(2);
        users[2] = vm.addr(3);
        shares[0] = 100;
        shares[1] = 200;
        shares[2] = 300;

        // Encode the distribute yield message.
        bytes memory encoded = _codec.encodeDistributeYieldMessage(users, shares);
        // Expected length: header (1 byte) + 3 users * 20 bytes each + 3 shares * 32 bytes each = 1 + 60 + 96 = 157 bytes.
        assertEq(encoded.length, 157);
        // Validate that the header corresponds to DISTRIBUTE_YIELD.
        assertEq(uint8(encoded[0]), LZMsgCodec.DISTRIBUTE_YIELD);
        {
            // Decode the yield message back into arrays.
            (address[] memory decodedUsers, uint256[] memory decodedShares) = _codec
                .decodeDistributeYieldMessage(encoded);
            // Check that the number of entries matches.
            assertEq(decodedUsers.length, 3);
            assertEq(decodedShares.length, 3);
            // Assert that every user and share in the decoded arrays match the original values.
            for (uint i = 0; i < 3; i++) {
                assertEq(decodedUsers[i], users[i]);
                assertEq(decodedShares[i], shares[i]);
            }
        }
    }

    function test_EncodeDecodeDistributeYieldMessageAndUpdateOracle() public view {
        // Set up test arrays with 2 entries.
        address[] memory users = new address[](2);
        uint256[] memory shares = new uint256[](2);

        users[0] = vm.addr(1);
        users[1] = vm.addr(2);

        shares[0] = 500;
        shares[1] = 600;

        uint256 totalValue = 1000;
        uint256 totalShares = 1100;

        bytes memory encoded = _codec.encodeDistributeYieldMessageAndUpdateOracle(
            users,
            shares,
            totalValue,
            totalShares
        );
        // Expected length: 1 + 32 + 32 + (2 * (20 + 32)) = 1 + 64 + 104 = 169 bytes.
        assertEq(encoded.length, 169);
        assertEq(uint8(encoded[0]), LZMsgCodec.DISTRIBUTE_YIELD_AND_UPDATE_ORACLE);
        {
            (
                address[] memory decodedUsers,
                uint256[] memory decodedShares,
                uint256 decodedTotalValue,
                uint256 decodedTotalShares
            ) = _codec.decodeDistributeYieldMessageAndUpdateOracle(encoded);
            assertEq(decodedTotalValue, totalValue);
            assertEq(decodedTotalShares, totalShares);
            assertEq(decodedUsers.length, users.length);
            assertEq(decodedShares.length, shares.length);
            for (uint i = 0; i < users.length; i++) {
                assertEq(decodedUsers[i], users[i]);
                assertEq(decodedShares[i], shares[i]);
            }
        }
    }

    function test_EncodeDecodeConfirmRedeemMessage() public view {
        // Set up test arrays with 2 entries.
        uint256[] memory requestIds = new uint256[](2);
        uint256[] memory values = new uint256[](2);

        // Set specific values for testing.
        requestIds[0] = 111;
        requestIds[1] = 222;
        values[0] = 333;
        values[1] = 444;

        // Encode the confirm redeem message.
        bytes memory encoded = _codec.encodeConfirmRedeemMessage(requestIds, values);
        // Expected length is 1 byte for header + 2*32 bytes for requestIds + 2*32 bytes for values = 129 bytes.
        assertEq(encoded.length, 129);
        // Validate the message type header.
        assertEq(uint8(encoded[0]), LZMsgCodec.CONFIRM_REDEEM);

        // Decode the message.
        {
            (uint256[] memory decodedRequestIds, uint256[] memory decodedValues) = _codec
                .decodeConfirmRedeemMessage(encoded);
            // Ensure that both arrays contain the correct number of elements.
            assertEq(decodedRequestIds.length, 2);
            assertEq(decodedValues.length, 2);
            // Verify that each element in the arrays is correct.
            for (uint i = 0; i < 2; i++) {
                assertEq(decodedRequestIds[i], requestIds[i]);
                assertEq(decodedValues[i], values[i]);
            }
        }
    }

    /// @notice Fuzz test for generating a default confirm redeem message.
    /// @param count The number of redeem entries to include.
    function testFuzz_DefaultConfirmRedeemMessage(uint256 count) public view {
        // Limit count to a reasonable range.
        vm.assume(count < 128);
        // Encode a default confirm redeem message using the given count.
        bytes memory encoded = _codec.defaultConfirmRedeemMessage(count);
        // The expected length is 1 byte for header plus count * 64 bytes (32 bytes for id, 32 for value per entry).
        uint256 expectedLength = 1 + (count * 64);
        assertEq(encoded.length, expectedLength);
        // Verify the header byte.
        assertEq(uint8(encoded[0]), LZMsgCodec.CONFIRM_REDEEM);

        // Decode the default redeem message.
        {
            (uint256[] memory decodedRequestIds, uint256[] memory decodedValues) = _codec
                .decodeConfirmRedeemMessage(encoded);
            // Verify that decoded arrays have the correct length.
            assertEq(decodedRequestIds.length, count);
            assertEq(decodedValues.length, count);
            // For default messages, each index should match its position.
            for (uint i = 0; i < count; i++) {
                assertEq(decodedRequestIds[i], i);
                assertEq(decodedValues[i], i);
            }
        }
    }

    /// @notice Fuzz test for generating a default distribute yield message.
    /// @param count The number of yield distribution entries.
    function testFuzz_DefaultDistributeYieldMessage(uint256 count) public view {
        // Restrict count to avoid excessive array sizes.
        vm.assume(count < 128);
        // Encode a default distribute yield message.
        bytes memory encoded = _codec.defaultDistributeYieldMessage(count);
        // Expected length: 1 byte header + count*52 bytes (20 bytes per address + 32 bytes per share).
        uint256 expectedLength = 1 + (count * 52);
        assertEq(encoded.length, expectedLength);
        // Verify the header byte.
        assertEq(uint8(encoded[0]), LZMsgCodec.DISTRIBUTE_YIELD);

        // Decode the message.
        {
            (address[] memory decodedUsers, uint256[] memory decodedShares) = _codec
                .decodeDistributeYieldMessage(encoded);
            // Ensure the decoded arrays have the correct length.
            assertEq(decodedUsers.length, count);
            assertEq(decodedShares.length, count);
            // The default values: each user is set to address(1) and each share equals its index.
            for (uint i = 0; i < count; i++) {
                assertEq(decodedUsers[i], address(0x0000000000000000000000000000000000000001));
                assertEq(decodedShares[i], i);
            }
        }
    }

    /// @notice Fuzz test for generating a default distribute yield message with oracle update.
    /// @param count The number of yield distribution entries.
    function testFuzz_DefaultDistributeYieldMessageAndUpdateOracle(uint256 count) public view {
        // Restrict count for practical array sizes.
        vm.assume(count < 128);
        // Encode the default message with oracle update.
        bytes memory encoded = _codec.defaultDistributeYieldMessageAndUpdateOracle(count);
        // Expected length: 1 byte header + 64 bytes (for oracle data: totalValue and totalShares) + count * 52 bytes.
        uint256 expectedLength = 1 + 64 + (count * 52);
        assertEq(encoded.length, expectedLength);
        // Check the header byte.
        assertEq(uint8(encoded[0]), LZMsgCodec.DISTRIBUTE_YIELD_AND_UPDATE_ORACLE);

        // Decode the message.
        {
            (
                address[] memory decodedUsers,
                uint256[] memory decodedShares,
                uint256 decodedTotalValue,
                uint256 decodedTotalShares
            ) = _codec.decodeDistributeYieldMessageAndUpdateOracle(encoded);
            // The default oracle values are expected to be 1 and 2.
            assertEq(decodedTotalValue, 1);
            assertEq(decodedTotalShares, 2);
            // Verify that the arrays have the right lengths.
            assertEq(decodedUsers.length, count);
            assertEq(decodedShares.length, count);
            // Check each default entry.
            for (uint i = 0; i < count; i++) {
                assertEq(decodedUsers[i], address(0x0000000000000000000000000000000000000001));
                assertEq(decodedShares[i], i);
            }
        }
    }

    /// @notice Tests that decoding a malformed message reverts with the expected error.
    function test_RevertWhen_MalformedMessage() public {
        // Create a malformed byte string.
        bytes memory malformed = "0x1234";

        // Expect the decoder to revert with the EMalformedMessage error when decoding an update oracle message.
        vm.expectRevert(LZMsgCodec.EMalformedMessage.selector);
        _codec.decodeUpdateOracle(malformed);

        // Similarly, the confirm deposit with update oracle decoder should revert.
        vm.expectRevert(LZMsgCodec.EMalformedMessage.selector);
        _codec.decodeConfirmDepositMessageAndUpdateOracle(malformed);

        // The yield distribution decoder should revert.
        vm.expectRevert(LZMsgCodec.EMalformedMessage.selector);
        _codec.decodeDistributeYieldMessage(malformed);

        // The confirm redeem decoder should revert.
        vm.expectRevert(LZMsgCodec.EMalformedMessage.selector);
        _codec.decodeConfirmRedeemMessage(malformed);
    }

    /// @notice Tests that encoding functions revert when provided arrays of mismatched lengths.
    function test_RevertWhen_ArrayLengthMissmatch() public {
        address[] memory users = new address[](2);
        uint256[] memory shares = new uint256[](3);

        uint256 totalValue = 1000;
        uint256 totalShares = 1100;

        // Expect the encoder to revert with an EArraysLengthMismatch error for yield messages.
        vm.expectRevert(LZMsgCodec.EArraysLengthMismatch.selector);
        _codec.encodeDistributeYieldMessageAndUpdateOracle(users, shares, totalValue, totalShares);

        vm.expectRevert(LZMsgCodec.EArraysLengthMismatch.selector);
        _codec.encodeDistributeYieldMessage(users, shares);
    }
}
