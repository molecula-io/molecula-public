// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.30;

import {IDelegationManager, IStrategy} from "./../external/interfaces/IDelegationManager.sol";
import {IRewardsCoordinatorTypes} from "./../external/interfaces/IRewardsCoordinator.sol";
import {BeaconChainProofs} from "./../external/libraries/BeaconChainProofs.sol";
import {IStrategyLib} from "./IStrategyLib.sol";

/// @title Deposit Manager Restaker Interface.
/// @notice Defines the functions and events required for restaking operations.
interface IDepositManagerRestaker {
    /// @dev Struct to add a new strategy.
    /// @param token Address of the token for which the strategy is added.
    /// @param newStrategy EigenLayer strategy contract.
    /// @param strategyLib Library for interacting with the strategy.
    struct AddStrategyData {
        address token;
        IStrategy newStrategy;
        IStrategyLib strategyLib;
    }

    /**
     * @dev Emitted when processing deposits into EigenLayer.
     * @param value Deposit value.
     * @param pubkey A BLS12-381 public key.
     * @param signature A BLS12-381 signature.
     * @param depositDataRoot The SHA-256 hash of the SSZ-encoded DepositData object.
     */
    event StakeNative(
        uint256 indexed value,
        bytes pubkey,
        bytes signature,
        bytes32 depositDataRoot
    );

    /// @dev Emitted when an operator is removed from the system.
    /// @param operator Address of the removed operator.
    event OperatorRemoved(address indexed operator);

    /// @dev Emitted when the operator delegation portions are changed.
    /// @param newOperatorsArray Array of operators with new portions.
    /// @param delegationPortions Array of delegation portions for each operator.
    event OperatorsPortionsChanged(address[] newOperatorsArray, uint64[] delegationPortions);

    /// @dev Emitted when a new operator is added to the system.
    /// @param operator Added operator's address.
    /// @param delegator Deployed delegator contract's address.
    event OperatorAdded(address indexed operator, address indexed delegator);

    /// @dev Emitted when a new strategy is added for a token.
    /// @param strategyData Array of structures containing the added strategy data.
    event StrategiesAdded(AddStrategyData[] indexed strategyData);

    /// @dev Error: Incorrect array length.
    error EIncorrectLength();

    /// @dev Error: Value amount is not enough for a deposit into EigenLayer.
    error ETooHighDepositValue();

    /// @dev Error: Sum of portions is not equal to `1`.
    error EWrongPortion();

    /// @dev Error: Attempt to remove the delegator with an active stake.
    error EDelegatorHasActiveStake();

    /// @dev Error: Added strategy address is not whitelisted by EigenLayer or does not match the added token.
    error EInvalidStrategyConfiguration(string);

    /// @dev Error: Operator is already added to the DepositManager contract.
    error EOperatorExists();

    /// @dev Error: Predicted clone address already has bytecode.
    error EContractAlreadyExists();

    /// @dev Error: Predicted clone address does not match the deployed clone.
    error EIncorrectPredictedAddress();

    /// @dev Error: No need to stake.
    error ENoNeedToStake();

    /**
     * @dev Process a deposit into the EigenLayer.
     * @param value Deposit value.
     * @param pubkey BLS12-381 public key.
     * @param signature BLS12-381 signature.
     * @param depositDataRoot SHA-256 hash of the SSZ-encoded `DepositData` object.
     */
    function stakeNative(
        uint256 value,
        bytes calldata pubkey,
        bytes calldata signature,
        bytes32 depositDataRoot
    ) external;

    /**
     * @dev Verify that one or more validators have their withdrawal credentials pointed at this EigenPod,
     * and award shares based on their effective balance. Proven validators are marked as `ACTIVE`
     * within the EigenPod, and future checkpoint proofs will need to include them.
     * @param operator Address of operator for which the verification data is provided.
     * @param beaconTimestamp Beacon chain timestamp sent to the 4788 oracle contract.
     * @param stateRootProof Proves a beacon state root against a beacon block root.
     * @param validatorIndices List of validator indices being proven.
     * @param validatorFieldsProofs Proofs of each validator's `validatorFields` against the beacon state root
     * @param validatorFields Fields of the beacon chain "Validator" container.
     */
    function verifyWithdrawalCredentials(
        address operator,
        uint64 beaconTimestamp,
        BeaconChainProofs.StateRootProof calldata stateRootProof,
        uint40[] calldata validatorIndices,
        bytes[] calldata validatorFieldsProofs,
        bytes32[][] calldata validatorFields
    ) external;

    /**
     * @dev Initiates a checkpoint proof by snapshotting both the pod's ETH balance and the current block's parent block root.
     * @param operator Operator's address.
     */
    function startCheckpoint(address operator) external;

    /**
     * @dev Verifies checkpoint proofs for the currently active checkpoint and tracks the exited validator balance.
     * @param operator Operator's address.
     * @param balanceContainerProof Proves the beacon's current balance container root against a checkpoint's `beaconBlockRoot`.
     * @param proofs Proofs for one or more validator current balances against `balanceContainerRoot`.
     */
    function verifyCheckpointProofs(
        address operator,
        BeaconChainProofs.BalanceContainerProof calldata balanceContainerProof,
        BeaconChainProofs.BalanceProof[] calldata proofs
    ) external;

    /**
     * @dev Undelegate shares from the old AVS operator to a new AVS operator.
     * @param oldOperator Address of the old operator to remove delegation.
     * @param newOperator Address of new operator for delegation.
     * @param approverSignatureAndExpiry Operator's signature for delegation.
     * @param approverSalt Unique data to prevent signature collisions.
     */
    function redelegate(
        address oldOperator,
        address newOperator,
        IDelegationManager.SignatureWithExpiry calldata approverSignatureAndExpiry,
        bytes32 approverSalt
    ) external;

    /**
     * @dev Claims rewards from EigenLayer for the specified operator using the provided merkle claim.
     * @param operator Operator's address.
     * @param claim `RewardsMerkleClaim` object to process claim.
     */
    function claimRewards(
        address operator,
        IRewardsCoordinatorTypes.RewardsMerkleClaim calldata claim
    ) external;

    /**
     * @dev Restakes tokens into the configured Pools.
     * @param tokens Tokens to restake.
     * @param values Amounts of tokens to restake.
     */
    function restakeRewards(address[] calldata tokens, uint256[] calldata values) external;

    /**
     * @dev Claims rewards from EigenLayer and automatically restakes them into the protocol.
     * @param operator Operator's address.
     * @param claim RewardsMerkleClaim object to process claim.
     */
    function claimRewardsAndRestake(
        address operator,
        IRewardsCoordinatorTypes.RewardsMerkleClaim calldata claim
    ) external;

    /**
     * @dev Picks the delegator with the TVL below the threshold or returns the first one in the list.
     * @return Address of the chosen delegator.
     */
    function chooseDelegatorForDeposit() external view returns (address);

    /**
     * @dev Getter for the Strategy contract deployed for the token.
     * @param token Address of the Strategy contract token.
     * @return strategy Address of the Strategy contract.
     */
    function getStrategy(address token) external view returns (IStrategy strategy);

    /**
     * @dev Adds a new operator to the DepositManager contract with specified delegation portions.
     * @param operator Address of the new operator to add.
     * @param salt Unique salt for deterministic delegator address generation.
     * @param approverSignatureAndExpiry Operator's signature for delegation approval.
     * @param approverSalt Unique data to prevent signature collisions.
     * @param newOperatorsArray Array of operators with new portions for each pool.
     * @param newDelegationPortions Array of delegation portions for each pool.
     */
    function addOperator(
        address operator,
        bytes32 salt,
        IDelegationManager.SignatureWithExpiry calldata approverSignatureAndExpiry,
        bytes32 approverSalt,
        address[] calldata newOperatorsArray,
        uint64[] calldata newDelegationPortions
    ) external;

    /**
     * @dev Removes an operator from the DepositManager contract and redistributes delegation portions.
     * @param operator Address of the operator to remove.
     * @param newOperatorsArray Array of operators with new portions for each pool.
     * @param newDelegationPortions Array of new delegation portions for remaining operators.
     */
    function removeOperator(
        address operator,
        address[] calldata newOperatorsArray,
        uint64[] calldata newDelegationPortions
    ) external;

    /**
     * @dev Sets the delegation portions for each operator in the system.
     * @param newOperatorsArray Array of operators with new portions for each pool.
     * @param delegationPortions Array of delegation portions in basis points, where 100% = 10000.
     */
    function setOperatorsPortions(
        address[] calldata newOperatorsArray,
        uint64[] calldata delegationPortions
    ) external;

    /**
     * @dev Setter Strategy contract for the token.
     * @param strategyData Struct containing the strategy data to add.
     */
    function addStrategies(AddStrategyData[] calldata strategyData) external;

    /**
     * @dev Getter for the WETH address.
     * @return Address of the WETH contract.
     */
    function wETH() external view returns (address);
}
