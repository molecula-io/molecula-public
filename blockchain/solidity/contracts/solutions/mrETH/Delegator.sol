// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.30;

import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {ValueValidator} from "./../../common/ValueValidator.sol";
import {ConstantsCoreV2} from "./../../coreV2/Constants.sol";
import {DelegatorStorage, IDelegationManager, IDelegator} from "./DelegatorStorage.sol";
import {IDelegationManagerTypes} from "./external/interfaces/IDelegationManager.sol";
import {IEigenPodManager, IStrategy, IEigenPod} from "./external/interfaces/IEigenPodManager.sol";
import {IRewardsCoordinatorTypes, IRewardsCoordinator} from "./external/interfaces/IRewardsCoordinator.sol";
import {IStrategyManager} from "./external/interfaces/IStrategyManager.sol";
import {BeaconChainProofs} from "./external/libraries/BeaconChainProofs.sol";
import {IDepositManagerPool} from "./interfaces/IDepositManagerPool.sol";

/// @title Delegator contract.
/// @notice Delegates the deposits to the operator.
contract Delegator is DelegatorStorage, Initializable, ValueValidator {
    using SafeERC20 for IERC20;
    using Address for address payable;

    /// @inheritdoc IDelegator
    function initialize(
        IDelegationManager delegationManager_,
        address rewardsCoordinator_,
        address operator_,
        IDelegationManager.SignatureWithExpiry calldata approverSignatureAndExpiry,
        bytes32 approverSalt
    ) external initializer notZeroAddress(rewardsCoordinator_) {
        depositManagerPool = msg.sender;

        delegationManager = delegationManager_;
        rewardsCoordinator = rewardsCoordinator_;

        // EigenLayer does not allow the zero address for the operator.
        // slither-disable-next-line missing-zero-check
        operator = operator_;

        // slither-disable-next-line unused-return
        delegationManager.eigenPodManager().createPod();

        delegationManager.delegateTo(operator_, approverSignatureAndExpiry, approverSalt);
    }

    /// @inheritdoc IDelegator
    function stakeNative(
        bytes calldata pubkey,
        bytes calldata signature,
        bytes32 depositDataRoot
    ) external payable virtual only(depositManagerPool) {
        // Increase the ETH balance for the pending stake.
        totalPendingNativeSupply += msg.value;

        // Stake ETH into EigenLayer.
        delegationManager.eigenPodManager().stake{value: msg.value}(
            pubkey,
            signature,
            depositDataRoot
        );
    }

    /// @inheritdoc IDelegator
    function stakeToken(
        IStrategy strategy,
        IERC20 token,
        uint256 value
    ) external only(depositManagerPool) {
        // Transfer the amount from the `depositManagerPool` contract.
        // slither-disable-next-line arbitrary-send-erc20
        token.safeTransferFrom(depositManagerPool, address(this), value);

        // Approve to the Strategy manager contract.
        token.forceApprove(address(delegationManager.strategyManager()), value);

        // Deposit LRT tokens into EigenLayer.
        // slither-disable-next-line unused-return
        delegationManager.strategyManager().depositIntoStrategy(strategy, token, value);
    }

    /// @inheritdoc IDelegator
    function verifyWithdrawalCredentials(
        uint64 beaconTimestamp,
        BeaconChainProofs.StateRootProof calldata stateRootProof,
        uint40[] calldata validatorIndices,
        bytes[] calldata validatorFieldsProofs,
        bytes32[][] calldata validatorFields
    ) external virtual only(depositManagerPool) {
        if (totalPendingNativeSupply < STAKE_AMOUNT_NATIVE) {
            revert EIncorrectRestakeAmount();
        }

        totalPendingNativeSupply -= STAKE_AMOUNT_NATIVE;

        delegationManager.eigenPodManager().getPod(address(this)).verifyWithdrawalCredentials(
            beaconTimestamp,
            stateRootProof,
            validatorIndices,
            validatorFieldsProofs,
            validatorFields
        );
    }

    /// @inheritdoc IDelegator
    function startCheckpoint() external only(depositManagerPool) {
        IEigenPod eigenPod = delegationManager.eigenPodManager().getPod(address(this));

        // Check if there is any active checkpoint.
        if (eigenPod.currentCheckpointTimestamp() != 0) revert ECheckpointAlreadyActive();

        // Start the checkpoint.
        eigenPod.startCheckpoint(true);
    }

    /// @inheritdoc IDelegator
    function verifyCheckpointProofs(
        BeaconChainProofs.BalanceContainerProof calldata balanceContainerProof,
        BeaconChainProofs.BalanceProof[] calldata proofs
    ) external only(depositManagerPool) {
        // Verify checkpoint proofs for validators' yield updated balance.
        delegationManager.eigenPodManager().getPod(address(this)).verifyCheckpointProofs(
            balanceContainerProof,
            proofs
        );
    }

    /// @inheritdoc IDelegator
    function redelegate(
        address newOperator,
        IDelegationManager.SignatureWithExpiry calldata approverSignatureAndExpiry,
        bytes32 approverSalt
    ) external only(depositManagerPool) {
        // EigenLayer does not allow the zero address for the operator.
        // slither-disable-next-line missing-zero-check
        operator = newOperator;

        delegationManager.delegateTo(newOperator, approverSignatureAndExpiry, approverSalt);
    }

    /// @inheritdoc IDelegator
    function claimRewards(
        IRewardsCoordinatorTypes.RewardsMerkleClaim calldata claim
    ) external only(depositManagerPool) {
        IRewardsCoordinator(rewardsCoordinator).processClaim(claim, depositManagerPool);
    }

    /**
     * @dev Complete a queued withdrawal request.
     * @param requestId Request ID.
     */
    function _completeQueuedWithdrawal(uint256 requestId) internal {
        // Get the queued withdrawal info.
        QueuedWithdrawal memory queuedWithdrawal = queuedWithdrawalInfo[requestId];

        // Extract strategy and token from the withdrawal data.
        IStrategy strategy = queuedWithdrawal.strategies[0];
        IERC20 token = strategy.underlyingToken();

        // Prepare a list of tokens to complete the queued withdrawal.
        IERC20[] memory tokens = new IERC20[](1);
        tokens[0] = token;

        // Complete the queued withdrawal from EigenLayer with `receiveAsToken` set to `true`.
        // slither-disable-next-line reentrancy-benign,reentrancy-no-eth
        delegationManager.completeQueuedWithdrawal(
            IDelegationManagerTypes.Withdrawal(
                address(this),
                queuedWithdrawal.delegatedTo,
                address(this),
                queuedWithdrawal.nonce,
                queuedWithdrawal.startBlock,
                queuedWithdrawal.strategies,
                queuedWithdrawal.initialWithdrawableShares
            ),
            tokens,
            true
        );

        // Reduce the queued shares and get the withdrawn shares amount.
        uint256 withdrawnShares = queuedWithdrawal.initialWithdrawableShares[0];

        // Deduct queued shares with the initial withdrawable shares queued for tracking TVL.
        queuedShares[address(token)] -= withdrawnShares;

        // Delete the queued withdrawal info to free up storage.
        // slither-disable-next-line costly-loop
        delete queuedWithdrawalInfo[requestId];

        // Transfer assets to `depositManagerPool`.
        _sendWithdrawnValue(strategy, withdrawnShares);

        // Emit a event that signals the withdrawal has been completed.
        emit WithdrawCompleted(requestId, token, withdrawnShares);
    }

    /// @inheritdoc IDelegator
    function completeQueuedWithdrawals(
        uint256[] calldata requestIds
    ) external only(depositManagerPool) {
        uint256 length = requestIds.length;

        for (uint256 i; i < length; ++i) {
            _completeQueuedWithdrawal(requestIds[i]);
        }
    }

    /// @inheritdoc IDelegator
    function queueWithdrawal(
        IERC20 token,
        uint256 tokenAmount,
        IStrategy strategy,
        uint256 requestId
    ) external only(depositManagerPool) returns (uint256) {
        (
            IDelegationManager.QueuedWithdrawalParams[] memory queuedWithdrawalParams,
            uint256 sharesToWithdraw
        ) = _getQueuedWithdrawalParams(
                token,
                tokenAmount,
                delegationManager.eigenPodManager(),
                strategy
            );

        // Track initial withdrawable shares of the token in `queuedWithdrawal`.
        queuedShares[address(token)] += sharesToWithdraw;

        IStrategy[] memory strategies = new IStrategy[](1);
        strategies[0] = strategy;

        uint256[] memory initialWithdrawableShares = new uint256[](1);
        initialWithdrawableShares[0] = sharesToWithdraw;

        // Save the queued withdrawal info.
        queuedWithdrawalInfo[requestId] = QueuedWithdrawal(
            0,
            operator,
            uint32(block.number),
            delegationManager.cumulativeWithdrawalsQueued(address(this)),
            strategies,
            initialWithdrawableShares,
            delegationManager.queueWithdrawals(queuedWithdrawalParams)[0]
        );

        // Emit an event that signals that the withdrawal has started.
        emit WithdrawStarted(requestId, address(this), strategy, sharesToWithdraw);

        return sharesToWithdraw;
    }

    /**
     * @dev Get the queued withdrawal parameters.
     * @param token Token to withdraw.
     * @param value Token amount to withdraw.
     * @param eigenPodManager EigenPodManager's contract.
     * @param strategy Strategy to withdraw.
     * @return queuedWithdrawalParams Queued withdrawal parameters.
     * @return withdrawableShares Withdrawable shares.
     */
    function _getQueuedWithdrawalParams(
        IERC20 token,
        uint256 value,
        IEigenPodManager eigenPodManager,
        IStrategy strategy
    )
        internal
        view
        returns (IDelegationManager.QueuedWithdrawalParams[] memory queuedWithdrawalParams, uint256)
    {
        // Length 1 array for queued withdrawal params struct.
        queuedWithdrawalParams = new IDelegationManager.QueuedWithdrawalParams[](1);
        queuedWithdrawalParams[0].strategies = new IStrategy[](1);
        queuedWithdrawalParams[0].depositShares = new uint256[](1);

        // Length 1 array for strategies and `withdrawableShares`.
        uint256[] memory withdrawableShares = new uint256[](1);

        if (address(token) == ConstantsCoreV2.NATIVE_TOKEN) {
            // Set `beaconChainEthStrategy` for ETH.
            queuedWithdrawalParams[0].strategies[0] = eigenPodManager.beaconChainETHStrategy();

            // Set withdrawable shares for ETH.
            withdrawableShares[0] = value;
        } else {
            // Set the strategy of the token.
            queuedWithdrawalParams[0].strategies[0] = strategy;

            // Set the withdrawable shares of the token.
            withdrawableShares[0] = strategy.underlyingToSharesView(value);
        }

        // Set deposit shares for the token.
        queuedWithdrawalParams[0].depositShares = delegationManager.convertToDepositShares(
            address(this),
            queuedWithdrawalParams[0].strategies,
            withdrawableShares
        );

        // Set the withdrawer as this contract's address.
        queuedWithdrawalParams[0].__deprecated_withdrawer = address(this);

        return (queuedWithdrawalParams, withdrawableShares[0]);
    }

    /**
     * @dev Send the withdrawn value to `depositManagerPool`.
     * @param strategy Strategy to re-deposit.
     * @param reducedShares Reduced shares.
     */
    function _sendWithdrawnValue(IStrategy strategy, uint256 reducedShares) internal {
        // Get the underlying token of the strategy.
        IERC20 token = strategy.underlyingToken();

        // Send the withdrawn value to `depositManagerPool` if the token is native.
        if (address(token) == ConstantsCoreV2.NATIVE_TOKEN) {
            return payable(depositManagerPool).sendValue(reducedShares);
        }

        // Get the strategy's withdrawn balance.
        uint256 withdrawnBalance = strategy.sharesToUnderlyingView(reducedShares);

        // Transfer the withdrawn balance to `depositManagerPool`.
        token.safeTransferFrom(address(this), depositManagerPool, withdrawnBalance);
    }

    /// @inheritdoc IDelegator
    function delegatorSupply() external view returns (uint256 operatorEthBalance) {
        // Get the strategy manager from the delegation manager.
        IStrategyManager strategyManager = IDelegationManager(delegationManager).strategyManager();

        // Get all deposited strategies.
        // slither-disable-next-line unused-return
        (IStrategy[] memory _strategies, ) = strategyManager.getDeposits(address(this));

        uint256 strategiesLength = _strategies.length;

        // Get all withdrawable tokens' amount from the EigenLayer's operator converted to ETH.
        for (uint256 j = 0; j < strategiesLength; ++j) {
            // Get the tokenSupply
            uint256 tokenSupply = getDelegatorTokenSupply(_strategies[j]);

            // Convert `tokenSupply` into ETH and increase `operatorEthBalance`.
            operatorEthBalance += IDepositManagerPool(depositManagerPool).convertTokenToETH(
                _strategies[j],
                tokenSupply
            );
        }

        // Get the native supply and increase `operatorEthBalance`.
        operatorEthBalance += getDelegatorNativeSupply();
    }

    /// @inheritdoc IDelegator
    function getDelegatorTokenSupply(IStrategy strategy) public view returns (uint256 tokenSupply) {
        return strategy.userUnderlyingView(address(this));
    }

    /// @inheritdoc IDelegator
    function getDelegatorNativeSupply() public view returns (uint256 nativeSupply) {
        // Get the value of the native ETH staked.
        IEigenPodManager eigenPodManager = IDelegationManager(delegationManager).eigenPodManager();

        // Get withdrawable amount of restaked ETH.
        int256 podOwnerShares = eigenPodManager.podOwnerDepositShares(address(this));
        uint256 pendingNativeSupply = totalPendingNativeSupply;

        // Handle the case of negative pod owner shares.
        if (podOwnerShares < 0) {
            // Get the absolute value of the pod owner shares.
            uint256 absPodOwnerShares = uint256(-podOwnerShares);
            if (pendingNativeSupply > absPodOwnerShares) {
                unchecked {
                    nativeSupply = pendingNativeSupply - absPodOwnerShares;
                }
            }
        } else {
            nativeSupply = pendingNativeSupply + uint256(podOwnerShares);
        }
    }

    /// @dev Allows the contract to receive ETH from EigenLayer.
    receive() external payable {}
}
