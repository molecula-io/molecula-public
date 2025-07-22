// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import {OApp, Origin, MessagingFee} from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/OApp.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract TestLayerZero is OApp {
    constructor(address _endpoint, address _owner) OApp(_endpoint, _owner) Ownable(_owner) {}

    /// @dev Some arbitrary data you want to deliver to the destination chain!
    string public data;

    /**
     * @notice Sends a message from the source to destination chain.
     * @param _dstEid Destination chain's endpoint ID.
     * @param _message The message to send.
     * @param _options Message execution options (e.g., for sending gas to destination).
     */
    function send(
        uint32 _dstEid,
        string calldata _message,
        bytes calldata _options
    ) external payable {
        // Encodes the message before invoking `_lzSend`.
        // Replace with whatever data you want to send!
        bytes memory _payload = abi.encode(_message);
        _lzSend(
            _dstEid,
            _payload,
            _options,
            // Fee in the native gas and ZRO token.
            MessagingFee(msg.value, 0),
            // Refund address in case of a failed source message.
            payable(msg.sender)
        );
    }

    /**
     * @dev Called when the data is received from the protocol. It overrides the equivalent function in the parent contract.
     * Protocol messages are defined as packets, comprised of the following parameters.
     * @param _origin Struct containing information about where the packet came from.
     * @param _guid Global ID for tracking the packet.
     * @param payload Encoded message.
     * @param _executor Executor address as specified by the OApp.
     * @param _options Any extra data or options to trigger on receipt.
     */
    function _lzReceive(
        Origin calldata _origin,
        bytes32 _guid,
        bytes calldata payload,
        address _executor, // Executor address as specified by the OApp.
        bytes calldata _options // Any extra data or options to trigger on receipt.
    ) internal override {
        _origin;
        _guid;
        _executor;
        _options;
        // Decode the payload to get the message. In this case, the type is `string`, but it depends on your encoding.
        data = abi.decode(payload, (string));
    }

    /** @dev Quotes the gas needed to pay for the full omnichain transaction.
     * @param _dstEid Destination chain's endpoint ID.
     * @param _message The message to send.
     * @param _options Message execution options
     * @param _payInLzToken boolean for which token to return fee in
     * @return nativeFee Estimated gas fee in the native gas.
     * @return lzTokenFee Estimated gas fee in the ZRO token.
     */
    function quote(
        uint32 _dstEid, // Destination chain's endpoint ID.
        string memory _message, // The message to send.
        bytes calldata _options, // Message execution options
        bool _payInLzToken // boolean for which token to return fee in
    ) public view returns (uint256 nativeFee, uint256 lzTokenFee) {
        bytes memory _payload = abi.encode(_message);
        MessagingFee memory fee = _quote(_dstEid, _payload, _options, _payInLzToken);
        return (fee.nativeFee, fee.lzTokenFee);
    }
}
