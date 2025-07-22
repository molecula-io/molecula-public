// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.24;

import {OApp, Origin} from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/OApp.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IAccountant} from "./../../../common/interfaces/IAccountant.sol";
import {IRebaseToken} from "./../../../common/interfaces/IRebaseToken.sol";
import {ISetterOracle} from "./../../../common/interfaces/ISetterOracle.sol";
import {LZMsgCodec} from "./../../../common/layerzero/LZMsgCodec.sol";
import {OptionsLZ, Ownable2Step, Ownable} from "./../../../common/layerzero/OptionsLZ.sol";
import {ZeroValueChecker} from "./../../../common/ZeroValueChecker.sol";
import {UsdtOFT, SendParam, OFTReceipt, MessagingFee} from "./../common/UsdtOFT.sol";

/// @title AccountantLZ - Accountant contract for handling LayerZero-based cross-chain transactions.
/// @notice This contract facilitates cross-chain USDT transactions using LayerZero and UsdtOFT.
contract AccountantLZ is OApp, OptionsLZ, ZeroValueChecker, IAccountant {
    using SafeERC20 for IERC20;

    /// @dev LayerZero destination chain ID for cross-chain communication.
    uint32 public immutable DST_EID;

    /// @dev Interface for the USDT token.
    IERC20 public immutable USDT;

    /// @dev Interface for the UsdtOFT token used for cross-chain transfers.
    UsdtOFT public immutable USDT_OFT;

    /// @dev Address of the Oracle contract for updating the supply data.
    ISetterOracle public immutable ORACLE;

    /// @dev Address of the underlying token contract being managed by Accountant. E.g., mUSD token.
    address public underlyingToken;

    /// @dev Tracks the amount of locked USDT pending redemption.
    uint256 public lockedToRedeem;

    /// @dev Ensures that only the underlying token contract can call certain functions.
    modifier onlyUnderlyingToken() {
        if (underlyingToken != msg.sender) {
            revert NotMyToken();
        }
        _;
    }

    /// @dev Error: The operation already exists.
    error EOperationAlreadyExists();

    /// @dev Error: The operation is not yet ready.
    error EOperationNotReady();

    /// @dev Error: Caller is not the Molecula token contract.
    error NotMyToken();

    /// @dev Error: Insufficient USDT balance in the contract.
    error EInsufficientBalance();

    /**
     * @dev Initializes the contract and sets up the required addresses.
     * @param initialOwner Address of the contract owner.
     * @param authorizedLZConfiguratorAddress Address of the LayerZero configurator.
     * @param endpoint Address of the LayerZero endpoint contract.
     * @param lzDstEid LayerZero destination chain ID.
     * @param usdtAddress Address of the USDT token contract.
     * @param usdtOFTAddress Address of the UsdtOFT contract for cross-chain transfers.
     * @param oracleAddress Address of the Oracle contract.
     */
    constructor(
        address initialOwner,
        address authorizedLZConfiguratorAddress,
        address endpoint,
        uint32 lzDstEid,
        address usdtAddress,
        address usdtOFTAddress,
        address oracleAddress
    ) OApp(endpoint, initialOwner) OptionsLZ(initialOwner, authorizedLZConfiguratorAddress) {
        DST_EID = lzDstEid;
        USDT = IERC20(usdtAddress);
        USDT_OFT = UsdtOFT(usdtOFTAddress);
        ORACLE = ISetterOracle(oracleAddress);
        /*
         * To enable contract-controlled transfers, we pre-approve the contract for the maximum allowance
         * in the constructor as USDT (TRC20) transfers always return `false` (breaks `safeTransfer`),
         * although `safeTransferFrom` works.
         * This allows the contract to use `safeTransferFrom` for USDT operations safely and reliably.
         */
        USDT.forceApprove(address(this), type(uint256).max);
    }

    /**
     * @dev Confirms a deposit.
     * The function gets called when the data is received from the protocol.
     * It overrides the equivalent function in the parent contract.
     * Protocol messages are defined as packets, comprised of the following parameters.
     * param _origin Struct containing information about where the packet came from.
     * param _guid Global ID for tracking the packet.
     * param _executor Executor address as specified by the OApp.
     * param _options Any extra data or options to trigger on receipt.
     * @param payload Encoded message.
     */
    function _lzReceive(
        Origin calldata /*_origin*/,
        bytes32 /*_guid*/,
        bytes calldata payload,
        address /*_executor*/, // Executor address as specified by the OApp.
        bytes calldata /*_options*/ // Any extra data or options to trigger on receipt.
    ) internal override {
        // Decode the payload to get the message. Get the message type.
        uint8 msgType = uint8(payload[0]);
        // Confirm the deposit message.
        if (msgType == LZMsgCodec.CONFIRM_DEPOSIT) {
            (uint256 requestId, uint256 shares) = LZMsgCodec.lzDecodeUint256Pair(payload[1:]);
            _confirmDeposit(requestId, shares);
        } else if (msgType == LZMsgCodec.CONFIRM_REDEEM) {
            (uint256[] memory requestId, uint256[] memory values) = LZMsgCodec
                .lzDecodeConfirmRedeemMessage(payload[1:]);
            _redeem(requestId, values);
        } else if (msgType == LZMsgCodec.DISTRIBUTE_YIELD) {
            (address[] memory users, uint256[] memory shares) = LZMsgCodec
                .lzDecodeDistributeYieldMessage(payload[1:]);
            _distributeYield(users, shares);
        } else if (msgType == LZMsgCodec.CONFIRM_DEPOSIT_AND_UPDATE_ORACLE) {
            (
                uint256 requestId,
                uint256 shares,
                uint256 totalValue,
                uint256 totalShares
            ) = LZMsgCodec.lzDecodeConfirmDepositMessageAndUpdateOracle(payload[1:]);
            _setOracleData(totalValue, totalShares);
            _confirmDeposit(requestId, shares);
        } else if (msgType == LZMsgCodec.DISTRIBUTE_YIELD_AND_UPDATE_ORACLE) {
            (
                address[] memory users,
                uint256[] memory shares,
                uint256 totalValue,
                uint256 totalShares
            ) = LZMsgCodec.lzDecodeDistributeYieldMessageAndUpdateOracle(payload[1:]);
            _setOracleData(totalValue, totalShares);
            _distributeYield(users, shares);
        } else if (msgType == LZMsgCodec.UPDATE_ORACLE) {
            (uint256 totalValue, uint256 totalShares) = LZMsgCodec.lzDecodeUint256Pair(payload[1:]);
            _setOracleData(totalValue, totalShares);
        } else {
            revert LZMsgCodec.ELzUnknownMessage();
        }
    }

    /**
     * @dev Overrides the `_transferOwnership` function to resolve conflicts.
     * @param newOwner The address of the new owner.
     */
    function _transferOwnership(address newOwner) internal override(Ownable2Step, Ownable) {
        super._transferOwnership(newOwner);
    }

    /**
     * @dev Sets the oracle data.
     * @param totalValue Total value.
     * @param totalShares Total shares.
     */
    function _setOracleData(uint256 totalValue, uint256 totalShares) internal {
        ORACLE.setTotalSupply(totalValue, totalShares);
    }

    /**
     * @dev  Distributes yield.
     * @param users User's addresses.
     * @param shares Shares to distribute.
     */
    function _distributeYield(address[] memory users, uint256[] memory shares) internal {
        uint256 length = users.length;
        for (uint256 i = 0; i < length; ++i) {
            IRebaseToken(underlyingToken).distribute(users[i], shares[i]);
        }
    }

    /**
     * @dev Confirms a deposit.
     * @param requestId Deposit request ID.
     * @param shares Amount to deposit.
     */
    function _confirmDeposit(uint256 requestId, uint256 shares) internal {
        IRebaseToken(underlyingToken).confirmDeposit(requestId, shares);
    }

    /**
     * @dev Redeems the funds.
     * @param requestIds Deposit request IDs.
     * @param values Amount to deposit.
     */
    function _redeem(uint256[] memory requestIds, uint256[] memory values) internal {
        uint256 totalValue = IRebaseToken(underlyingToken).redeem(requestIds, values);
        // slither-disable-next-line reentrancy-benign
        lockedToRedeem += totalValue;
    }

    /**
     * @dev Overrides the gas needed to pay for the full omnichain transaction.
     * @param _nativeFee The native fee in ETH.
     * @return nativeFee The amount of native currency paid.
     */
    function _payNative(uint256 _nativeFee) internal virtual override returns (uint256 nativeFee) {
        if (msg.value < _nativeFee) revert NotEnoughNative(msg.value);
        return _nativeFee;
    }

    /**
     * @dev Overrides the `transferOwnership` function to resolve conflicts.
     * @param newOwner The address of the new owner.
     */
    function transferOwnership(address newOwner) public override(Ownable2Step, Ownable) onlyOwner {
        super.transferOwnership(newOwner);
    }

    /**
     * @dev Sets the underlying token address.
     * @param underlyingTokenAddress Underlying token address.
     */
    function setUnderlyingToken(
        address underlyingTokenAddress
    ) external onlyOwner checkNotZero(underlyingTokenAddress) {
        underlyingToken = underlyingTokenAddress;
    }

    /**
     * @notice Confirms a redemption request by transferring the specified amount of USDT to the user.
     * @dev This function ensures that the contract has sufficient balance and that the amount being
     *      redeemed does not exceed the locked amount for redemption.
     * @param user The address of the user receiving the redeemed USDT.
     * @param value The amount of USDT to confirm for redemption.
     */
    function confirmRedeem(address user, uint256 value) external onlyUnderlyingToken {
        // Retrieve the current USDT balance of the contract.
        uint256 balance = USDT.balanceOf(address(this));

        // Ensure that the contract has enough USDT to fulfill the redemption request.
        if (balance < value) {
            revert EInsufficientBalance();
        }

        // Ensure that the locked amount for redemption is sufficient.
        if (lockedToRedeem < value) {
            revert EInsufficientBalance();
        }

        // Reduce the locked amount by the redeemed value.
        unchecked {
            lockedToRedeem -= value;
        }

        /*
         * Transfer the redeemed USDT to the user.
         *
         * WARNING:
         * USDT on TRON (TRC20) does not support `safeTransfer` as in OpenZeppelin's SafeERC20.
         * The `transfer` function on TRON USDT always returns `false`, even when the transfer succeeds.
         * This breaks compatibility with `safeTransfer`, which expects a `true` return value.
         * However, `safeTransferFrom` works as expected.
         *
         * - Do not use `safeTransfer` with TRON USDT.
         * - Use `safeTransferFrom`, or call `transfer` directly and do not rely on its return value.
         */
        USDT.safeTransferFrom(address(this), user, value);
    }

    /**
     * @notice Initiates a deposit request by transferring USDT from the user,
     *         sending it cross-chain via UsdtOFT, and relaying the request using LayerZero.
     * @dev Ensures the sender has provided enough gas for both cross-chain USDT transfer
     *      and LayerZero messaging. Excess ETH is refunded using inline assembly.
     * @param requestId The unique identifier of the deposit request.
     * @param user The address of the user initiating the deposit.
     * @param value The amount of USDT to be deposited.
     */
    function requestDeposit(
        uint256 requestId,
        address user,
        uint256 value
    ) external payable onlyUnderlyingToken {
        if (value > 0) {
            // Track the initial USDT balance to ensure accurate transfer calculations.
            uint256 balanceBefore = USDT.balanceOf(address(this));

            // Use `safeTransferFrom` to securely move the specified `value`
            // of USDT from `user` to the current contract address.
            // slither-disable-next-line arbitrary-send-erc20
            USDT.safeTransferFrom(user, address(this), value);

            // Recalculate the actual amount received by subtracting the previous balance from the new balance.
            // This accounts for transfer fees or tokens with custom transfer logic.
            value = USDT.balanceOf(address(this)) - balanceBefore;

            // Approve the transferred USDT for spending by the UsdtOFT contract.
            USDT.forceApprove(address(USDT_OFT), value);

            // Get the recipient on the destination chain.
            bytes32 agent = _getPeerOrRevert(DST_EID);

            // Prepare structured parameters for sending USDT cross-chain via UsdtOFT.
            SendParam memory sendParam = SendParam({
                dstEid: DST_EID, // Ethereum endpoint ID: LayerZero destination chain.
                to: agent, // Recipient on Ethereum, converted to bytes32.
                amountLD: value, // Amount of USDT being sent.
                minAmountLD: (value - ((value * USDT_OFT.feeBps()) / USDT_OFT.BPS_DENOMINATOR())), // Minimum acceptable amount after fees.
                extraOptions: "", // No extra options provided.
                composeMsg: "", // No additional message composition needed.
                oftCmd: "" // No special OFT command required.
            });

            // Quote the amount received on the destination chain after the OFT processing.
            // slither-disable-next-line unused-return, solhint-disable-next-line check-send-result
            (, , OFTReceipt memory oftReceipt) = USDT_OFT.quoteOFT(sendParam);

            // Quote the gas fee required for sending USDT via UsdtOFT.
            MessagingFee memory usdtFee = USDT_OFT.quoteSend(sendParam, false);

            // Retrieve the LayerZero messaging options specific to a deposit request.
            bytes memory lzOptions = getLzOptions(LZMsgCodec.REQUEST_DEPOSIT, 0);

            // Encode the LayerZero payload to include the request ID and the received amount after fees.
            bytes memory payload = LZMsgCodec.lzEncodeRequestDepositMessage(
                requestId,
                oftReceipt.amountReceivedLD
            );

            // Quote the gas fee required for sending the LayerZero message.
            MessagingFee memory sendFee = _quote(DST_EID, payload, lzOptions, false);

            // Calculate the total required fee: the sum of USDT-OFT transfer and LayerZero message fees.
            uint256 totalRequiredFee = usdtFee.nativeFee + sendFee.nativeFee;

            // Execute the USDT transfer across chains using UsdtOFT.
            // slither-disable-next-line unused-return, solhint-disable-next-line avoid-tx-origin, check-send-result
            USDT_OFT.send{value: usdtFee.nativeFee}(sendParam, usdtFee, tx.origin);

            // Use LayerZero to send the deposit request message to the destination chain.
            _lzSend(
                DST_EID, // Destination LayerZero Endpoint ID.
                payload, // Encoded LayerZero payload containing deposit request details.
                lzOptions, // LayerZero options for processing the message.
                sendFee, // The required fee in the native gas and ZRO token, if applicable.
                // solhint-disable-next-line avoid-tx-origin
                payable(tx.origin) // Refund any unused gas to the original transaction sender.
            );

            // Refund any excess ETH sent by the caller back to tx.origin using inline assembly.
            // slither-disable-next-line assembly, solhint-disable-next-line no-inline-assembly
            assembly {
                let refundAmount := sub(callvalue(), totalRequiredFee) // Calculate the excess ETH amount.
                if gt(refundAmount, 0) {
                    // If there is any excess amount, attempt to refund to `tx.origin`.
                    let success := call(gas(), origin(), refundAmount, 0, 0, 0, 0)
                    if iszero(success) {
                        // If the refund fails, revert the transaction.
                        revert(0, 0)
                    }
                }
            }
        }
    }

    /// @inheritdoc IAccountant
    function requestRedeem(uint256 requestId, uint256 shares) external payable onlyUnderlyingToken {
        // Get options for LayerZero.
        bytes memory lzOptions = getLzOptions(LZMsgCodec.REQUEST_REDEEM, 0);

        // Encodes the message before invoking `_lzSend`.
        bytes memory payload = LZMsgCodec.lzEncodeRequestRedeemMessage(requestId, shares);
        MessagingFee memory sendFee = _quote(DST_EID, payload, lzOptions, false);

        // Extract the native fee from the `sendFee` struct for use in assembly.
        uint256 nativeFee = sendFee.nativeFee;

        // Send the data to LayerZero.
        _lzSend(
            DST_EID, // Destination LayerZero Endpoint ID.
            payload, // Encoded LayerZero payload containing deposit request details.
            lzOptions, // LayerZero options for processing the message.
            sendFee, // The required fee in native gas and ZRO token, if applicable.
            // solhint-disable-next-line avoid-tx-origin
            payable(tx.origin) // Refund address in case of a failed source message.
        );

        // Refund any excess ETH sent by the caller back to tx.origin using inline assembly.
        // slither-disable-next-line assembly, solhint-disable-next-line no-inline-assembly
        assembly {
            let refundAmount := sub(callvalue(), nativeFee) // Calculate the excess ETH amount.
            if gt(refundAmount, 0) {
                // If there is any excess amount, attempt to refund to `tx.origin`.
                let success := call(gas(), origin(), refundAmount, 0, 0, 0, 0)
                if iszero(success) {
                    // If the refund fails, revert the transaction.
                    revert(0, 0)
                }
            }
        }
    }

    /**
     * @dev Quotes the gas needed to pay for the full omnichain transaction,
     *      including LayerZero and USDT_OFT transfer fees, if applicable.
     * @param msgType Message type to determine the fee structure.
     * @return nativeFee Estimated gas fee in native gas: ETH or similar.
     * @return lzTokenFee Estimated gas fee in ZRO token.
     * @return lzOptions LayerZero options.
     */
    function quote(
        uint8 msgType
    ) external view returns (uint256 nativeFee, uint256 lzTokenFee, bytes memory lzOptions) {
        // slither-disable-next-line uninitialized-local
        bytes memory payload;

        if (msgType == LZMsgCodec.REQUEST_DEPOSIT) {
            lzOptions = getLzOptions(LZMsgCodec.REQUEST_DEPOSIT, 0);
            payload = LZMsgCodec.lzEncodeRequestDepositMessage(1, 1);

            bytes32 agent = _getPeerOrRevert(DST_EID);

            // Prepare a mock `SendParam` for fee estimation.
            SendParam memory sendParam = SendParam({
                dstEid: DST_EID, // Destination endpoint: Ethereum.
                to: agent, // Mock recipient address on Ethereum.
                amountLD: 1e6, // 1 USDT for estimation.
                minAmountLD: 0, // Min acceptable amount. Mock value.
                extraOptions: "", // No extra options.
                composeMsg: "", // No composed message.
                oftCmd: "" // No special OFT command.
            });

            // Fetch the USDT_OFT transfer fee.
            MessagingFee memory usdtFee = USDT_OFT.quoteSend(sendParam, false);
            nativeFee += usdtFee.nativeFee;
            lzTokenFee += usdtFee.lzTokenFee;
        } else if (msgType == LZMsgCodec.REQUEST_REDEEM) {
            lzOptions = getLzOptions(LZMsgCodec.REQUEST_REDEEM, 0);
            payload = LZMsgCodec.lzEncodeRequestRedeemMessage(3, 3);
        } else {
            revert LZMsgCodec.ELzUnknownMessage();
        }

        // Fetch the LayerZero messaging fee.
        MessagingFee memory fee = _quote(DST_EID, payload, lzOptions, false);

        // Sum the LayerZero native and USDT_OFT fees, if applicable.
        nativeFee += fee.nativeFee;
        lzTokenFee += fee.lzTokenFee;

        return (nativeFee, lzTokenFee, lzOptions);
    }
}
