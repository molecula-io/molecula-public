// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.28;

import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {ValueValidator} from "../../common/ValueValidator.sol";
import {DelegatorStorage, IDelegationManager, IDelegator} from "../../solutions/mrETH/DelegatorStorage.sol";
import {IStrategy} from "../../solutions/mrETH/external/interfaces/IStrategy.sol";
import {BeaconChainProofs} from "../../solutions/mrETH/external/libraries/BeaconChainProofs.sol";

/// @title Mock Delegator contract for Sepolia.
/// @notice Delegates deposits to the operator.
contract MockSepoliaDelegator is DelegatorStorage, Initializable, ValueValidator {
    using SafeERC20 for IERC20;
    using Address for address;

    /// @dev Error thrown when an operation is not supported by Sepolia.
    error EUnsupported();

    /// @inheritdoc IDelegator
    function initialize(
        IDelegationManager delegationManager_,
        address operator,
        IDelegationManager.SignatureWithExpiry calldata approverSignatureAndExpiry,
        bytes32 approverSalt
    ) external initializer {
        depositManager = msg.sender;

        delegationManager = delegationManager_;

        delegationManager.delegateTo(operator, approverSignatureAndExpiry, approverSalt);
    }

    /// @inheritdoc IDelegator
    function stakeNative(
        bytes calldata,
        bytes calldata,
        bytes32
    ) external payable only(depositManager) {
        revert EUnsupported();
    }

    /// @inheritdoc IDelegator
    function stakeToken(
        IStrategy strategy,
        IERC20 token,
        uint256 value
    ) external only(depositManager) {
        // Transfer the amount from the depositManager contract.
        // slither-disable-next-line arbitrary-send-erc20
        token.safeTransferFrom(depositManager, address(this), value);

        // Approve to the Strategy Manager contract.
        token.forceApprove(address(delegationManager.strategyManager()), value);

        // Deposit LRT tokens into EigenLayer.
        // slither-disable-next-line unused-return
        delegationManager.strategyManager().depositIntoStrategy(strategy, token, value);
    }

    /// @inheritdoc IDelegator
    function verifyWithdrawalCredentials(
        uint64,
        BeaconChainProofs.StateRootProof calldata,
        uint40[] calldata,
        bytes[] calldata,
        bytes32[][] calldata
    ) external view only(depositManager) {
        revert EUnsupported();
    }

    /// @inheritdoc IDelegator
    function redelegate(
        address newOperator,
        IDelegationManager.SignatureWithExpiry calldata approverSignatureAndExpiry,
        bytes32 approverSalt
    ) external only(depositManager) {
        delegationManager.delegateTo(newOperator, approverSignatureAndExpiry, approverSalt);
    }

    /**
     * @dev Sets the `totalPendingNativeSupply` value for testing purposes.
     * @param value New value to assign to `totalPendingNativeSupply`.
     */
    function setTotalPendingNativeSupply(uint256 value) external only(depositManager) {
        totalPendingNativeSupply = value;
    }
}
