// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.30;

import {OApp, Origin, MessagingFee} from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/OApp.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IAgent} from "./../../../common/interfaces/IAgent.sol";
import {IOracle} from "./../../../common/interfaces/IOracle.sol";
import {ISupplyManager} from "./../../../common/interfaces/ISupplyManager.sol";
import {LZMsgCodec} from "./../../../common/layerzero/LZMsgCodec.sol";
import {OptionsLZ, Ownable2Step, Ownable} from "./../../../common/layerzero/OptionsLZ.sol";
import {ZeroValueChecker} from "./../../../common/ZeroValueChecker.sol";
import {UsdtOFT, SendParam, OFTReceipt} from "./../common/UsdtOFT.sol";

/// @title AgentLZ - Agent contract for LayerZero cross-chain communication.
contract AgentLZ is OApp, OptionsLZ, ReentrancyGuard, ZeroValueChecker, IAgent {
    using SafeERC20 for IERC20;

    /// @dev LayerZero destination chain ID.
    uint32 public immutable DST_EID;

    /// @dev Address of the SupplyManager contract.
    address public immutable SUPPLY_MANAGER;

    /// @dev Interface for USDT token.
    IERC20 public immutable USDT;

    /// @dev Interface for UsdtOFT token.
    UsdtOFT public immutable USDT_OFT;

    /// @dev Boolean flag indicating whether oracle data should be sent via LayerZero.
    bool public updateOracleData;

    /// @dev Mapping of executed deposit requests.
    mapping(uint256 => DepositInfo) public deposits;

    /**
     * @dev Enum representing the status of a deposit.
     * @param None No deposit recorded.
     * @param ReadyToConfirm Deposit recorded, awaiting confirmation.
     * @param Executed Deposit executed.
     */
    enum DepositStatus {
        None,
        ReadyToConfirm,
        Executed
    }

    /**
     * @dev Struct for storing deposit information.
     * @param status Current status of the deposit.
     * @param queryId Query ID associated with the deposit.
     * @param value Amount deposited.
     * @param shares Number of shares allocated.
     */
    struct DepositInfo {
        DepositStatus status;
        uint256 queryId;
        uint256 value;
        uint256 shares;
    }

    /// @dev Error: Operation with the given request ID already exists.
    error EOperationAlreadyExists();

    /// @dev Error: Operation is not yet ready for confirmation.
    error EOperationNotReady();

    /// @dev Error: Caller is not the authorized Supply Manager.
    error ENotMySupplyManager();

    /// @dev Event emitted when a redeem operation is executed.
    event Redeem();

    /// @dev Modifier ensuring that only the Supply Manager can call a function.
    modifier onlySupplyManager() {
        if (msg.sender != SUPPLY_MANAGER) {
            revert ENotMySupplyManager();
        }
        _;
    }

    /**
     * @dev Constructs the AgentLZ contract.
     * @param initialOwner Owner's address.
     * @param authorizedLZConfiguratorAddress Address of the authorized LayerZero configurator.
     * @param endpoint Address of the LayerZero endpoint contract.
     * @param supplyManagerAddress Address of the Supply Manager contract.
     * @param lzDstEid LayerZero destination chain ID.
     * @param usdtAddress Address of the USDT token.
     * @param usdtOFTAddress Address of the UsdtOFT token.
     */
    constructor(
        address initialOwner,
        address authorizedLZConfiguratorAddress,
        address endpoint,
        address supplyManagerAddress,
        uint32 lzDstEid,
        address usdtAddress,
        address usdtOFTAddress
    ) OApp(endpoint, initialOwner) OptionsLZ(initialOwner, authorizedLZConfiguratorAddress) {
        SUPPLY_MANAGER = supplyManagerAddress;
        DST_EID = lzDstEid;
        USDT = IERC20(usdtAddress);
        USDT_OFT = UsdtOFT(usdtOFTAddress);
        updateOracleData = true;
    }

    /**
     * @dev Called when the data is received from the protocol.
     * It overrides the equivalent function in the parent contract.
     * Protocol messages are defined as packets, comprised of the following parameters.
     * Call on depositing.
     * param _origin Struct containing information about where the packet came from.
     * param _guid Global ID for tracking the packet.
     * param _executor Executor address as specified by the OApp.
     * param _options Extra data or options to trigger upon receipt.
     * @param payload Encoded message.
     */
    function _lzReceive(
        Origin calldata /*_origin*/,
        bytes32 /*_guid*/,
        bytes calldata payload,
        address /*_executor*/, // Executor address as specified by the OApp.
        bytes calldata /*_options*/ // Extra data or options to trigger on receipt.
    ) internal override {
        // Decode the payload to get the message. Get the message type.
        uint8 msgType = uint8(payload[0]);
        if (msgType == LZMsgCodec.REQUEST_DEPOSIT) {
            // Decode the payload.
            (uint256 requestId, uint256 value) = LZMsgCodec.lzDecodeUint256Pair(payload[1:]);
            // Call the `deposit` method.
            _deposit(requestId, value);
        } else if (msgType == LZMsgCodec.REQUEST_REDEEM) {
            // Decode the payload.
            (uint256 requestId, uint256 value) = LZMsgCodec.lzDecodeUint256Pair(payload[1:]);
            // Call the `requestRedeem` method.
            _requestRedeem(requestId, value);
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
     * @dev Deposit method.
     * @param requestId Deposit request ID.
     * @param value Deposit amount.
     */
    function _deposit(uint256 requestId, uint256 value) internal {
        // Check whether the deposit operation already exists.
        if (deposits[requestId].status != DepositStatus.None) {
            revert EOperationAlreadyExists();
        }

        // Store the deposit operation in the `deposits` mapping.
        deposits[requestId] = DepositInfo(DepositStatus.ReadyToConfirm, requestId, value, 0);

        // Emit an event to log the deposit operation.
        // At this point, the shares have not been calculated yet.
        // Set the shares amount to zero, until the deposit is confirmed.
        emit Deposit(requestId, value, 0);
    }

    /**
     * @notice Requests a redemption from the Supply Manager.
     * @dev Calls the Supply Manager's `requestRedeem` method.
     * @param requestId Redeem operation request ID.
     * @param shares Redeem operation amount.
     */
    function _requestRedeem(uint256 requestId, uint256 shares) internal {
        // Call the Supply Manager's `requestRedeem` method.
        uint256 value = ISupplyManager(SUPPLY_MANAGER).requestRedeem(
            address(USDT),
            requestId,
            shares
        );
        // Emit an event to log the redeem operation.
        emit RedeemRequest(requestId, shares, value);
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
     * @dev Sets the `updateOracleData` status.
     * @param isSend `updateOracleData` status.
     */
    function setSendOracleData(bool isSend) external onlyOwner {
        updateOracleData = isSend;
    }

    /**
     * @notice Sends a message from the source to the destination chain.
     * @dev This function confirms a deposit by executing the deposit on the Supply Manager,
     *      encoding the confirmation message, and sending it via LayerZero.
     *      If the user overpays, the excess gas is refunded using inline assembly.
     * @param requestId The unique identifier of the deposit request.
     */
    function confirmDeposit(uint256 requestId) external payable nonReentrant {
        // Ensure that the deposit operation exists and is in the correct state for confirmation.
        if (deposits[requestId].status != DepositStatus.ReadyToConfirm) {
            revert EOperationNotReady();
        }

        // Retrieve the deposit amount from the mapping.
        uint256 value = deposits[requestId].value;

        // Approve the deposit amount to be transferred to the Molecula Pool via the Supply Manager.
        USDT.forceApprove(ISupplyManager(SUPPLY_MANAGER).getMoleculaPool(), value);

        // Execute the deposit on the Supply Manager and receive the corresponding number of shares.
        uint256 shares = ISupplyManager(SUPPLY_MANAGER).deposit(address(USDT), requestId, value);

        // Declare the LayerZero options and payload variables.
        bytes memory lzOptions;
        bytes memory payload;

        // Check whether the oracle data needs to be updated along with the deposit confirmation.
        if (updateOracleData) {
            // Retrieve the total value and total shares from the Oracle.
            (uint256 totalValue, uint256 totalShares) = IOracle(SUPPLY_MANAGER).getTotalSupply();

            // Encode the deposit confirmation message along with the updated oracle data.
            payload = LZMsgCodec.lzEncodeConfirmDepositMessageAndUpdateOracle(
                requestId,
                shares,
                totalValue,
                totalShares
            );

            // Retrieve LayerZero options specific to this message type.
            lzOptions = getLzOptions(LZMsgCodec.CONFIRM_DEPOSIT_AND_UPDATE_ORACLE, 0);
        } else {
            // Encode the deposit confirmation message without updating the oracle data.
            payload = LZMsgCodec.lzEncodeConfirmDepositMessage(requestId, shares);

            // Retrieve the LayerZero options specific to this message type.
            lzOptions = getLzOptions(LZMsgCodec.CONFIRM_DEPOSIT, 0);
        }

        // Estimate the LayerZero messaging fee required to send the payload.
        MessagingFee memory sendFee = _quote(DST_EID, payload, lzOptions, false);

        // Extract the native fee from the sendFee struct for use in assembly.
        uint256 nativeFee = sendFee.nativeFee;

        // Send the LayerZero message, providing the necessary gas fee.
        _lzSend(
            DST_EID, // Destination LayerZero Endpoint ID: TRON network.
            payload, // Encoded payload containing updated oracle data.
            lzOptions, // LayerZero options for processing the message.
            sendFee, // The required fee in the native gas and ZRO token, if applicable.
            payable(msg.sender) // Refund any unused gas to the original transaction sender.
        );

        // Refund any excess gas back to the caller using inline assembly.
        // slither-disable-next-line assembly, solhint-disable-next-line no-inline-assembly
        assembly {
            // Calculate any excess gas.
            let refundAmount := sub(callvalue(), nativeFee)
            if gt(refundAmount, 0) {
                // If there is an excess gas, transfer the refund to the caller.
                let success := call(gas(), caller(), refundAmount, 0, 0, 0, 0)
                if iszero(success) {
                    // If the transfer fails, revert.
                    revert(0, 0)
                }
            }
        }

        // Update the deposit status in the mapping to mark it as executed.
        deposits[requestId].shares = shares;
        deposits[requestId].status = DepositStatus.Executed;

        // Emit an event to log the successful deposit confirmation.
        emit DepositConfirm(requestId, deposits[requestId].shares);
    }

    /// @inheritdoc IAgent
    // solhint-disable-next-line gas-calldata-parameters
    function redeem(
        address fromAddress,
        uint256[] calldata requestIds,
        uint256[] memory values,
        uint256 totalValue
    ) external payable onlySupplyManager {
        // Track the initial USDT balance to ensure accurate transfer calculations.
        uint256 balanceBefore = USDT.balanceOf(address(this));

        // Use `safeTransferFrom` to securely move the specified `totalValue`
        // of USDT from `fromAddress` to the current contract address.
        // slither-disable-next-line arbitrary-send-erc20
        USDT.safeTransferFrom(fromAddress, address(this), totalValue);

        // Recalculate the actual amount received by subtracting the previous balance from the new balance.
        // This accounts for transfer fees or tokens with custom transfer logic.
        uint256 totalValueToSend = USDT.balanceOf(address(this)) - balanceBefore;

        // Approve the total USDT amount for spending by the UsdtOFT contract.
        USDT.forceApprove(address(USDT_OFT), totalValueToSend);

        // Get the recipient on the destination chain.
        bytes32 accountant = _getPeerOrRevert(DST_EID);

        // Prepare structured parameters for the cross-chain USDT transfer via the UsdtOFT contract.
        SendParam memory sendParam = SendParam({
            dstEid: DST_EID, // Destination LayerZero Endpoint ID. TRON in this case.
            to: accountant, // Recipient on the destination chain. Value converted to bytes32.
            amountLD: totalValueToSend, // Total USDT amount being sent.
            minAmountLD: (totalValueToSend -
                ((totalValueToSend * USDT_OFT.feeBps()) / USDT_OFT.BPS_DENOMINATOR())), // Minimum acceptable amount after fees.
            extraOptions: "", // No extra options provided.
            composeMsg: "", // No additional message composition needed.
            oftCmd: "" // No special OFT command required.
        });

        // Quote the amount received on the destination chain after the OFT processing.
        // slither-disable-next-line unused-return, solhint-disable-next-line check-send-result
        (, , OFTReceipt memory oftReceipt) = USDT_OFT.quoteOFT(sendParam);

        // Quote the fee required for sending USDT across chains using UsdtOFT.
        MessagingFee memory usdtFee = USDT_OFT.quoteSend(sendParam, false);

        // Scale each redemption value proportionally to the actual amount received after the OFT fees.
        // This ensures the sum of individual redemptions matches the total received amount.
        uint256 length = values.length;
        for (uint256 i = 0; i < length; ++i) {
            values[i] = (values[i] * oftReceipt.amountReceivedLD) / totalValue;
        }

        // Encode the payload that will be sent via LayerZero.
        // This payload contains details of the redemption request.
        bytes memory payload = LZMsgCodec.lzEncodeConfirmRedeemMessage(requestIds, values);

        // Retrieve the LayerZero messaging options based on the number of requests being processed.
        bytes memory lzOptions = getLzOptions(LZMsgCodec.CONFIRM_REDEEM, requestIds.length);

        // Quote the fee required for the LayerZero message transmission.
        MessagingFee memory sendFee = _quote(DST_EID, payload, lzOptions, false);

        // Calculate the total required fee: sum of USDT-OFT transfer fee and LayerZero message fee.
        uint256 totalRequiredFee = usdtFee.nativeFee + sendFee.nativeFee;

        // Execute the USDT transfer across chains using UsdtOFT.
        // slither-disable-next-line unused-return, solhint-disable-next-line check-send-result, avoid-tx-origin
        USDT_OFT.send{value: usdtFee.nativeFee}(sendParam, usdtFee, tx.origin);

        // Use LayerZero to send the confirmation payload to the destination chain.
        _lzSend(
            DST_EID, // Destination LayerZero Endpoint ID.
            payload, // Encoded LayerZero payload containing redemption details.
            lzOptions, // LayerZero options for processing the message.
            sendFee, // The required fee in native gas and ZRO token, if applicable.
            // solhint-disable-next-line avoid-tx-origin
            payable(tx.origin) // Refund any unused gas to the original transaction sender.
        );

        // Refund any excess ETH sent by the caller back to `tx.origin`, using assembly.
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

        // Emit an event to log the redemption operation.
        emit Redeem();
    }

    /// @inheritdoc IAgent
    function distribute(
        address[] calldata users,
        uint256[] calldata shares
    ) external payable onlySupplyManager {
        // Declare LayerZero options and payload variables.
        bytes memory lzOptions;
        bytes memory payload;

        // Check whether the oracle data needs to be updated along with yield distribution.
        if (updateOracleData) {
            // Retrieve LayerZero options for updating oracle data.
            lzOptions = getLzOptions(LZMsgCodec.DISTRIBUTE_YIELD_AND_UPDATE_ORACLE, users.length);

            // Retrieve the total value and total shares from the Oracle.
            (uint256 oracleTotalValue, uint256 totalShares) = IOracle(SUPPLY_MANAGER)
                .getTotalSupply();

            // Encode the yield distribution message along with updated oracle data.
            payload = LZMsgCodec.lzEncodeDistributeYieldMessageAndUpdateOracle(
                users,
                shares,
                oracleTotalValue,
                totalShares
            );
        } else {
            // Retrieve the LayerZero options without updating the oracle data.
            lzOptions = getLzOptions(LZMsgCodec.DISTRIBUTE_YIELD, users.length);

            // Encode the yield distribution message without the oracle updates.
            payload = LZMsgCodec.lzEncodeDistributeYieldMessage(users, shares);
        }

        // Quote the LayerZero messaging fee required for sending the payload.
        MessagingFee memory sendFee = _quote(DST_EID, payload, lzOptions, false);

        // Extract the native fee from the sendFee struct for use in assembly.
        uint256 nativeFee = sendFee.nativeFee;

        // Use LayerZero to send the yield distribution message to the destination chain.
        _lzSend(
            DST_EID, // Destination LayerZero Endpoint ID.
            payload, // Encoded LayerZero payload containing yield distribution details.
            lzOptions, // LayerZero options for processing the message.
            sendFee, // The required fee in native gas and ZRO token, if applicable.
            // solhint-disable-next-line avoid-tx-origin
            payable(tx.origin) // Refund any unused gas to the original transaction sender.
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

        // Emit an event to log the yield distribution operation.
        emit DistributeYield(users, shares);
    }

    /**
     * @notice Updates the Oracle on TRON by retrieving the latest total value and shares,
     *         encoding them into a LayerZero message, and sending it to the destination chain.
     * @dev Ensures the sender has provided enough gas for LayerZero messaging, refunding an excess.
     */
    function updateOracle() external payable nonReentrant {
        // Retrieve the latest total value and total shares from the Supply Manager's Oracle.
        (uint256 totalValue, uint256 totalShares) = IOracle(SUPPLY_MANAGER).getTotalSupply();

        // Retrieve LayerZero options specific to the `updateOracle` message.
        bytes memory lzOptions = getLzOptions(LZMsgCodec.UPDATE_ORACLE, 0);

        // Encode the total value and total shares into the LayerZero payload.
        bytes memory payload = LZMsgCodec.lzEncodeUpdateOracle(totalValue, totalShares);

        // Quote the LayerZero messaging fee required for sending the payload.
        MessagingFee memory sendFee = _quote(DST_EID, payload, lzOptions, false);

        // Extract the native fee from the `sendFee` struct for use in assembly.
        uint256 nativeFee = sendFee.nativeFee;

        // Use LayerZero to send the Oracle update message to the destination chain.
        _lzSend(
            DST_EID, // Destination LayerZero Endpoint ID: TRON network.
            payload, // Encoded payload containing updated oracle data.
            lzOptions, // LayerZero options for processing the message.
            sendFee, // The required fee in native gas and ZRO token, if applicable.
            payable(msg.sender) // Refund any unused gas to the original transaction sender.
        );

        // Refund any excess ETH sent by the caller back to `msg.sender`, using inline assembly.
        // slither-disable-next-line assembly, solhint-disable-next-line no-inline-assembly
        assembly {
            let refundAmount := sub(callvalue(), nativeFee) // Calculate the excess ETH amount.
            if gt(refundAmount, 0) {
                // If there is any excess amount, attempt to refund to the caller.
                let success := call(gas(), caller(), refundAmount, 0, 0, 0, 0)
                if iszero(success) {
                    // If the refund fails, revert the transaction.
                    revert(0, 0)
                }
            }
        }
    }

    /// @inheritdoc IAgent
    function getERC20Token() external view returns (address token) {
        return address(USDT);
    }

    /**
     * @notice Estimates the gas fees required for executing an omnichain transaction.
     * @dev This function calculates the estimated LayerZero fees for a given message type
     *      and, if applicable, includes the USDT_OFT fees for cross-chain transfers.
     * @param msgType The message type being quoted (e.g., REQUEST_DEPOSIT, CONFIRM_REDEEM).
     * @param arrLen The length of the array for certain message types (e.g., CONFIRM_REDEEM, DISTRIBUTE_YIELD).
     * @return nativeFee The estimated gas fee required in the native blockchain token (e.g., ETH).
     * @return lzTokenFee The estimated gas fee in the LayerZero ZRO token, if applicable.
     * @return lzOptions The LayerZero options that would be used in the actual transaction.
     */
    function quote(
        uint8 msgType,
        uint256 arrLen
    ) external view returns (uint256 nativeFee, uint256 lzTokenFee, bytes memory lzOptions) {
        // slither-disable-next-line uninitialized-local
        bytes memory payload;

        // Check the message type and determine the appropriate payload and LayerZero options.
        if (
            msgType == LZMsgCodec.CONFIRM_DEPOSIT ||
            msgType == LZMsgCodec.CONFIRM_DEPOSIT_AND_UPDATE_ORACLE
        ) {
            if (updateOracleData) {
                // If updating the oracle data, include total supply details.
                payload = LZMsgCodec.lzEncodeConfirmDepositMessageAndUpdateOracle(1, 2, 3, 4);
                lzOptions = getLzOptions(LZMsgCodec.CONFIRM_DEPOSIT_AND_UPDATE_ORACLE, 0);
            } else {
                // Standard deposit confirmation message.
                payload = LZMsgCodec.lzEncodeConfirmDepositMessage(2, 2);
                lzOptions = getLzOptions(LZMsgCodec.CONFIRM_DEPOSIT, 0);
            }
        } else if (msgType == LZMsgCodec.CONFIRM_REDEEM) {
            // Confirm redeem request for multiple deposit IDs.
            payload = LZMsgCodec.lzDefaultConfirmRedeemMessage(arrLen);
            lzOptions = getLzOptions(LZMsgCodec.CONFIRM_REDEEM, arrLen);
            bytes32 accountant = _getPeerOrRevert(DST_EID);
            // Create a mock SendParam struct for fee estimation with minimal values.
            SendParam memory sendParam = SendParam({
                dstEid: DST_EID, // Destination LayerZero Endpoint ID. E.g., Ethereum.
                to: accountant, // Mock recipient address on the destination chain.
                amountLD: 1e6, // 1 USDT for estimation.
                minAmountLD: 1, // Minimum acceptable amount. Value mocked.
                extraOptions: "", // No additional options provided.
                composeMsg: "", // No additional message composition.
                oftCmd: "" // No special OFT command used.
            });

            // Estimate the gas fee required for the cross-chain USDT transfer via UsdtOFT.
            MessagingFee memory usdtFee = USDT_OFT.quoteSend(sendParam, false);

            // Add the USDT_OFT fees to total estimated fees.
            nativeFee += usdtFee.nativeFee;
            lzTokenFee += usdtFee.lzTokenFee;
        } else if (
            msgType == LZMsgCodec.DISTRIBUTE_YIELD ||
            msgType == LZMsgCodec.DISTRIBUTE_YIELD_AND_UPDATE_ORACLE
        ) {
            if (updateOracleData) {
                // Include the updated oracle data in the yield distribution message.
                payload = LZMsgCodec.lzDefaultDistributeYieldMessageAndUpdateOracle(arrLen);
                lzOptions = getLzOptions(LZMsgCodec.DISTRIBUTE_YIELD_AND_UPDATE_ORACLE, arrLen);
            } else {
                // Standard yield distribution message.
                payload = LZMsgCodec.lzDefaultDistributeYieldMessage(arrLen);
                lzOptions = getLzOptions(LZMsgCodec.DISTRIBUTE_YIELD, arrLen);
            }
        } else if (msgType == LZMsgCodec.UPDATE_ORACLE) {
            // Oracle update request.
            payload = LZMsgCodec.lzEncodeUpdateOracle(1, 2);
            lzOptions = getLzOptions(LZMsgCodec.UPDATE_ORACLE, 0);
        } else if (msgType == LZMsgCodec.REQUEST_DEPOSIT) {
            // Estimate fees for a deposit request, which includes both LayerZero and USDT_OFT fees.
            lzOptions = getLzOptions(LZMsgCodec.REQUEST_DEPOSIT, 0);
            payload = LZMsgCodec.lzEncodeRequestDepositMessage(1, 1);
        } else {
            // If an unknown message type is provided, revert the transaction.
            revert LZMsgCodec.ELzUnknownMessage();
        }

        // Estimate the LayerZero messaging fee based on the payload.
        MessagingFee memory fee = _quote(DST_EID, payload, lzOptions, false);

        // Sum the LayerZero and USDT_OFT fees, if applicable.
        nativeFee += fee.nativeFee;
        lzTokenFee += fee.lzTokenFee;

        return (nativeFee, lzTokenFee, lzOptions);
    }
}
