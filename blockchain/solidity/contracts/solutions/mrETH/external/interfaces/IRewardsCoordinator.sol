/**
 * Link to the original contract:
 * https://github.com/Layr-Labs/eigenlayer-contracts/blob/main/src/contracts/interfaces/IRewardsCoordinator.sol
 */
// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../libraries/OperatorSetLib.sol";

import "./IAllocationManager.sol";
import "./IDelegationManager.sol";
import "./IStrategyManager.sol";
import "./IPauserRegistry.sol";
import "./IPermissionController.sol";
import "./IStrategy.sol";

interface IRewardsCoordinatorTypes {
    /**
     * @notice Linear combination of strategies and multipliers for AVSs to weigh EigenLayer strategies.
     * @param strategy EigenLayer strategy to be used for the reward submission.
     * @param multiplier Weight of the strategy in the reward submission.
     */
    struct StrategyAndMultiplier {
        IStrategy strategy;
        uint96 multiplier;
    }

    /**
     * @notice Reward struct for an operator.
     * @param operator Operator to reward.
     * @param amount Reward amount for the operator.
     */
    struct OperatorReward {
        address operator;
        uint256 amount;
    }

    /**
     * @notice Split struct for an operator.
     * @param oldSplitBips Old split in basis points. This is the split that is active if `block.timestamp < activatedAt`.
     * @param newSplitBips New split in basis points. This is the split that is active if `block.timestamp >= activatedAt`.
     * @param activatedAt Timestamp at which the split will be activated.
     */
    struct OperatorSplit {
        uint16 oldSplitBips;
        uint16 newSplitBips;
        uint32 activatedAt;
    }

    /**
     * Sliding Window for valid Reward Submission startTimestamp.
     *
     * Scenario A: GENESIS_REWARDS_TIMESTAMP IS WITHIN RANGE
     *         <-----MAX_RETROACTIVE_LENGTH-----> t (block.timestamp) <---MAX_FUTURE_LENGTH--->
     *             <--------------------valid range for startTimestamp------------------------>
     *             ^
     *         GENESIS_REWARDS_TIMESTAMP
     *
     *
     * Scenario B: GENESIS_REWARDS_TIMESTAMP IS OUT OF RANGE
     *         <-----MAX_RETROACTIVE_LENGTH-----> t (block.timestamp) <---MAX_FUTURE_LENGTH--->
     *         <------------------------valid range for startTimestamp------------------------>
     *     ^
     * GENESIS_REWARDS_TIMESTAMP
     * @notice RewardsSubmission struct submitted by AVSs when distributing rewards to their operators and stakers.
     * RewardsSubmission can cover a time range within the valid window for `startTimestamp` and must
     * be within maximum duration. See `createAVSRewardsSubmission()` for more details.
     * @param strategiesAndMultipliers Strategies and their relative weights cannot have duplicate
     * strategies and need to be sorted in the ascending address order.
     * @param token Reward token to distribute.
     * @param amount Total amount of tokens to distribute.
     * @param startTimestamp Timestamp in seconds at which the submission range is considered for distribution.
     * It could start in the past or in the future but within a valid range. See the explanation above.
     * @param duration Duration of the submission range in seconds. Must be `<= MAX_REWARDS_DURATION`.
     */
    struct RewardsSubmission {
        StrategyAndMultiplier[] strategiesAndMultipliers;
        IERC20 token;
        uint256 amount;
        uint32 startTimestamp;
        uint32 duration;
    }

    /**
     * @notice OperatorDirectedRewardsSubmission Struct submitted by AVSs when distributing operator-directed rewards for their operators and stakers.
     * @param strategiesAndMultipliers Strategies and their relative weights.
     * @param token Reward token to distribute.
     * @param operatorRewards Rewards for the operators.
     * @param startTimestamp Timestamp in seconds at which the submission range is considered for distribution.
     * @param duration Duration of the submission range in seconds.
     * @param description Description of the rewards submission's purpose.
     */
    struct OperatorDirectedRewardsSubmission {
        StrategyAndMultiplier[] strategiesAndMultipliers;
        IERC20 token;
        OperatorReward[] operatorRewards;
        uint32 startTimestamp;
        uint32 duration;
        string description;
    }

    /**
     * @notice Distribution root is a merkle root of the distribution of earnings for a given period.
     * The RewardsCoordinator stores all historical distribution roots so that earners can claim their
     * earnings against older roots. This is possible upon their wish with the merkle tree containing:
     * - The cumulative earnings of all earners.
     * - Tokens for a given period.
     * This enables earners (or their claimers if set) to claim all available earnings.
     * @param root Distribution's merket root.
     * @param rewardsCalculationEndTimestamp Timestamp in seconds until which rewards have been calculated.
     * @param activatedAt Timestamp in seconds at which the root can be claimed against.
     */
    struct DistributionRoot {
        bytes32 root;
        uint32 rewardsCalculationEndTimestamp;
        uint32 activatedAt;
        bool disabled;
    }

    /**
     * @notice Internal leaf in the merkle tree for the earner's account leaf.
     * @param earner Earner's address.
     * @param earnerTokenRoot Merkle root of the earner's token subtree.
     * Each leaf in the earner's token subtree is `TokenTreeMerkleLeaf`.
     */
    struct EarnerTreeMerkleLeaf {
        address earner;
        bytes32 earnerTokenRoot;
    }

    /**
     * @notice Actual leaves in the distribution merkle tree specifying the token earnings
     * for the respective earner's subtree. Each leaf is a claimable amount of a token for an earner.
     * @param token Token for which the earnings are being claimed.
     * @param cumulativeEarnings Cumulative earnings of the earner for the token.
     */
    struct TokenTreeMerkleLeaf {
        IERC20 token;
        uint256 cumulativeEarnings;
    }

    /**
     * @notice Claim against a distribution root called by an earning claimer. Can be the earner themself.
     * Each token claim will claim the difference between the earner's `cumulativeEarnings` and
     * the claimer's `cumulativeClaimed`. Each claim can specify which of the earner's earned tokens
     * they want to claim. See `processClaim()` for more details.
     * @param rootIndex Index of the root in the `DistributionRoots` list.
     * @param earnerIndex Index of the earner's account root in the merkle tree.
     * @param earnerTreeProof Proof of the earner's EarnerTreeMerkleLeaf against the merkle root.
     * @param earnerLeaf Earner's `EarnerTreeMerkleLeaf` struct, providing the earner address and `earnerTokenRoot`.
     * @param tokenIndices Indices of the token leaves in the earner's subtree.
     * @param tokenTreeProofs Proofs of the token leaves against the earner's `earnerTokenRoot`.
     * @param tokenLeaves Token leaves to claim.
     * @dev Merkle tree is structured with the merkle root at the top and `EarnerTreeMerkleLeaf` as internal leaves
     * in the tree. Each earner leaf has its own subtree with `TokenTreeMerkleLeaf` as leaves in the subtree.
     * To prove a claim against a specified rootIndex, which specifies the `distributionRoot` being used,
     * the claim will verify inclusion of:
     * 1. The earner leaf in the tree against `_distributionRoots[rootIndex].root`.
     * 2. Each token leaf in the earner's subtree against the earner's `earnerTokenRoot`.
     */
    struct RewardsMerkleClaim {
        uint32 rootIndex;
        uint32 earnerIndex;
        bytes earnerTreeProof;
        EarnerTreeMerkleLeaf earnerLeaf;
        uint32[] tokenIndices;
        bytes[] tokenTreeProofs;
        TokenTreeMerkleLeaf[] tokenLeaves;
    }

    /**
     * @notice Parameters for the RewardsCoordinator constructor.
     * @param delegationManager DelegationManager contract' address.
     * @param strategyManager StrategyManager contract' address.
     * @param allocationManager AllocationManager contract' address.
     * @param pauserRegistry PauserRegistry contract' address.
     * @param permissionController PermissionController contract' address.
     * @param CALCULATION_INTERVAL_SECONDS Interval at which rewards are calculated.
     * @param MAX_REWARDS_DURATION Maximum duration of a reward submission.
     * @param MAX_RETROACTIVE_LENGTH Maximum retroactive length of a reward submission.
     * @param MAX_FUTURE_LENGTH Maximum future length of a reward submission.
     * @param GENESIS_REWARDS_TIMESTAMP Timestamp at which rewards are calculated.
     * @param version Semantic version of the contract (e.g. `1.2.3`).
     * @dev Needed to avoid stack-too-deep errors.
     */
    struct RewardsCoordinatorConstructorParams {
        IDelegationManager delegationManager;
        IStrategyManager strategyManager;
        IAllocationManager allocationManager;
        IPauserRegistry pauserRegistry;
        IPermissionController permissionController;
        uint32 CALCULATION_INTERVAL_SECONDS;
        uint32 MAX_REWARDS_DURATION;
        uint32 MAX_RETROACTIVE_LENGTH;
        uint32 MAX_FUTURE_LENGTH;
        uint32 GENESIS_REWARDS_TIMESTAMP;
        string version;
    }
}

interface IRewardsCoordinatorEvents is IRewardsCoordinatorTypes {
    /// @notice Emitted when an AVS creates a valid `RewardsSubmission`.
    event AVSRewardsSubmissionCreated(
        address indexed avs,
        uint256 indexed submissionNonce,
        bytes32 indexed rewardsSubmissionHash,
        RewardsSubmission rewardsSubmission
    );

    /// @notice emitted when a valid `RewardsSubmission` is created for all stakers by a valid submitter.
    event RewardsSubmissionForAllCreated(
        address indexed submitter,
        uint256 indexed submissionNonce,
        bytes32 indexed rewardsSubmissionHash,
        RewardsSubmission rewardsSubmission
    );

    /// @notice emitted when a valid RewardsSubmission is created when rewardAllStakersAndOperators is called
    event RewardsSubmissionForAllEarnersCreated(
        address indexed tokenHopper,
        uint256 indexed submissionNonce,
        bytes32 indexed rewardsSubmissionHash,
        RewardsSubmission rewardsSubmission
    );

    /**
     * @notice Emitted when an AVS creates a valid `OperatorDirectedRewardsSubmission`
     * @param caller Address calling `createOperatorDirectedAVSRewardsSubmission`.
     * @param avs AVS on behalf of which the operator-directed rewards are being submitted.
     * @param operatorDirectedRewardsSubmissionHash Keccak256 hash of `avs`, `submissionNonce`, and `operatorDirectedRewardsSubmission`.
     * @param submissionNonce Current nonce of the AVS used to generate a unique submission hash.
     * @param operatorDirectedRewardsSubmission Operator-directed reward submission.
     * Contains the token, start timestamp, duration, operator rewards, description, strategy, and multipliers.
     */
    event OperatorDirectedAVSRewardsSubmissionCreated(
        address indexed caller,
        address indexed avs,
        bytes32 indexed operatorDirectedRewardsSubmissionHash,
        uint256 submissionNonce,
        OperatorDirectedRewardsSubmission operatorDirectedRewardsSubmission
    );

    /**
     * @notice Emitted when an AVS creates a valid `OperatorDirectedRewardsSubmission` for an operator set.
     * @param caller Address calling `createOperatorDirectedOperatorSetRewardsSubmission`.
     * @param operatorDirectedRewardsSubmissionHash Keccak256 hash of `avs`, `submissionNonce`, and `operatorDirectedRewardsSubmission`.
     * @param operatorSet `operatorSet` on behalf of which the operator-directed rewards are being submitted.
     * @param submissionNonce Current nonce of the AVS used to generate a unique submission hash.
     * @param operatorDirectedRewardsSubmission Operator-directed reward submission.
     * Contains the token, start timestamp, duration, operator rewards, description, strategy, and multipliers.
     */
    event OperatorDirectedOperatorSetRewardsSubmissionCreated(
        address indexed caller,
        bytes32 indexed operatorDirectedRewardsSubmissionHash,
        OperatorSet operatorSet,
        uint256 submissionNonce,
        OperatorDirectedRewardsSubmission operatorDirectedRewardsSubmission
    );

    /// @notice `rewardsUpdater` is responsible for submitting `DistributionRoots`, only the owner can set `rewardsUpdater`.
    event RewardsUpdaterSet(address indexed oldRewardsUpdater, address indexed newRewardsUpdater);

    event RewardsForAllSubmitterSet(
        address indexed rewardsForAllSubmitter,
        bool indexed oldValue,
        bool indexed newValue
    );

    event ActivationDelaySet(uint32 oldActivationDelay, uint32 newActivationDelay);
    event DefaultOperatorSplitBipsSet(
        uint16 oldDefaultOperatorSplitBips,
        uint16 newDefaultOperatorSplitBips
    );

    /**
     * @notice Emitted when the operator split for an AVS is set.
     * @param caller Address calling `setOperatorAVSSplit`.
     * @param operator Operator on behalf of which the split is being set.
     * @param avs AVS for which the split is being set by the operator.
     * @param activatedAt Timestamp at which the split will be activated.
     * @param oldOperatorAVSSplitBips Old split for the operator for the AVS.
     * @param newOperatorAVSSplitBips New split for the operator for the AVS.
     */
    event OperatorAVSSplitBipsSet(
        address indexed caller,
        address indexed operator,
        address indexed avs,
        uint32 activatedAt,
        uint16 oldOperatorAVSSplitBips,
        uint16 newOperatorAVSSplitBips
    );

    /**
     * @notice Emitted when the operator split for Programmatic Incentives is set.
     * @param caller Address calling `setOperatorPISplit`.
     * @param operator Operator on behalf of which the split is being set.
     * @param activatedAt Timestamp at which the split will be activated.
     * @param oldOperatorPISplitBips Old split for the operator for Programmatic Incentives.
     * @param newOperatorPISplitBips New split for the operator for Programmatic Incentives.
     */
    event OperatorPISplitBipsSet(
        address indexed caller,
        address indexed operator,
        uint32 activatedAt,
        uint16 oldOperatorPISplitBips,
        uint16 newOperatorPISplitBips
    );

    /**
     * @notice Emitted when the operator split for a given operatorSet is set.
     * @param caller Address calling `setOperatorSetSplit`.
     * @param operator Operator on behalf of which the split is being set.
     * @param operatorSet `operatorSet` for which the split is being set.
     * @param activatedAt Timestamp at which the split will be activated.
     * @param oldOperatorSetSplitBips Old split for the operator for `operatorSet`.
     * @param newOperatorSetSplitBips New split for the operator for `operatorSet`.
     */
    event OperatorSetSplitBipsSet(
        address indexed caller,
        address indexed operator,
        OperatorSet operatorSet,
        uint32 activatedAt,
        uint16 oldOperatorSetSplitBips,
        uint16 newOperatorSetSplitBips
    );

    event ClaimerForSet(
        address indexed earner,
        address indexed oldClaimer,
        address indexed claimer
    );

    /// @notice `rootIndex` is the specific array index of the newly created root in the storage array.
    event DistributionRootSubmitted(
        uint32 indexed rootIndex,
        bytes32 indexed root,
        uint32 indexed rewardsCalculationEndTimestamp,
        uint32 activatedAt
    );

    event DistributionRootDisabled(uint32 indexed rootIndex);

    /// @notice root is one of the submitted distribution roots that was claimed against.
    event RewardsClaimed(
        bytes32 root,
        address indexed earner,
        address indexed claimer,
        address indexed recipient,
        IERC20 token,
        uint256 claimedAmount
    );
}

/**
 * @title Interface for the `IRewardsCoordinator` contract.
 * @author Layr Labs, Inc.
 * @notice Terms of Service: https://docs.eigenlayer.xyz/overview/terms-of-service
 * @notice Allows AVSs to make "Reward Submissions", which get distributed amongst the AVSs' confirmed
 * operators and stakers delegated to those operators.
 * Calculations are performed based on the completed `RewardsSubmission`, with the results posted in
 * a merkle root against which stakers & operators can make claims.
 */
interface IRewardsCoordinator is IRewardsCoordinatorEvents {
    /**
     * @dev Initializes the addresses of the initial owner, pauser registry, reward updater, and
     * configures the initial paused status, `activationDelay`, and `defaultOperatorSplitBips`.
     */
    function initialize(
        address initialOwner,
        uint256 initialPausedStatus,
        address _rewardsUpdater,
        uint32 _activationDelay,
        uint16 _defaultSplitBips
    ) external;

    /**
     * @notice Creates a new rewards submission on behalf of an AVS, to be split amongst the
     * set of stakers delegated to operators who are registered to the AVS.
     * @param rewardsSubmissions Rewards submissions being created.
     * @dev Expected to be called by the ServiceManager of the AVS on behalf of which the submission is being made.
     * @dev Duration of `rewardsSubmission` cannot exceed `MAX_REWARDS_DURATION`.
     * @dev Duration of `rewardsSubmission` cannot be 0 and must be multiplied by `CALCULATION_INTERVAL_SECONDS`.
     * @dev Tokens are sent to the `RewardsCoordinator` contract.
     * @dev Strategies must be in ascending order of addresses to check for duplicates.
     * @dev This function will revert if the `rewardsSubmission` is malformed.
     * E.g. if the `strategies` and `weights` arrays are of non-equal lengths.
     */
    function createAVSRewardsSubmission(RewardsSubmission[] calldata rewardsSubmissions) external;

    /**
     * @notice Similar to `createAVSRewardsSubmission`, except the rewards are split amongst all stakers.
     * Not as with those delegated to operators registered to a single AVS and
     * a permissioned call based on the `isRewardsForAllSubmitter` mapping.
     * @param rewardsSubmissions Reward submissions being created.
     */
    function createRewardsForAllSubmission(
        RewardsSubmission[] calldata rewardsSubmissions
    ) external;

    /**
     * @notice Creates a new reward submission for all earners across all AVSs.
     * Earners in this case indicate all operators and their delegated stakers.
     * Undelegated stake is not rewarded from this RewardsSubmission. This interface is
     * only callable by the token hopper contract from the Eigen Foundation.
     * @param rewardsSubmissions Reward submissions being created.
     */
    function createRewardsForAllEarners(RewardsSubmission[] calldata rewardsSubmissions) external;

    /**
     * @notice Creates a new operator-directed reward submission on behalf of an AVS, to be split among:
     * - The operators.
     * - The set of stakers delegated to operators registered to the AVS.
     * @param avs AVS on behalf of which the reward is being submitted.
     * @param operatorDirectedRewardsSubmissions Operator-directed reward submissions being created.
     * @dev Expected to be called by the AVS' ServiceManager on behalf of which the submission is being made.
     * @dev Duration of `rewardsSubmission` cannot exceed `MAX_REWARDS_DURATION`.
     * @dev Duration of `rewardsSubmission` cannot be 0 and must be multiplied by `CALCULATION_INTERVAL_SECONDS`.
     * @dev Tokens are sent to the `RewardsCoordinator` contract.
     * @dev The `RewardsCoordinator` contract needs a token approval of sum of all `operatorRewards`
     * in `operatorDirectedRewardsSubmissions` before calling this function.
     * @dev Strategies must be in ascending order of addresses to check for duplicates.
     * @dev Operators must be in ascending order of addresses to check for duplicates..
     * @dev This function will revert if `operatorDirectedRewardsSubmissions` is malformed.
     */
    function createOperatorDirectedAVSRewardsSubmission(
        address avs,
        OperatorDirectedRewardsSubmission[] calldata operatorDirectedRewardsSubmissions
    ) external;

    /**
     * @notice Creates a new operator-directed reward submission for an operator set, to be split among:
     * - The operators.
     * - The set of stakers delegated to operators who are part of the operator set.
     * @param operatorSet Operator set for which the rewards are being submitted.
     * @param operatorDirectedRewardsSubmissions Operator-directed reward submissions being created.
     * @dev Expected to be called by the AVS that created the operator set.
     * @dev Duration of `rewardsSubmission` cannot exceed `MAX_REWARDS_DURATION`.
     * @dev Duration of `rewardsSubmission` cannot be 0 and must be multiplied by `CALCULATION_INTERVAL_SECONDS`.
     * @dev Tokens are sent to the `RewardsCoordinator` contract.
     * @dev The `RewardsCoordinator` contract needs a token approval of sum of all `operatorRewards`
     * in `operatorDirectedRewardsSubmissions` before calling this function
     * @dev Strategies must be in ascending order of addresses to check for duplicates.
     * @dev Operators must be in ascending order of addresses to check for duplicates.
     * @dev This function will revert if `operatorDirectedRewardsSubmissions` is malformed.
     */
    function createOperatorDirectedOperatorSetRewardsSubmission(
        OperatorSet calldata operatorSet,
        OperatorDirectedRewardsSubmission[] calldata operatorDirectedRewardsSubmissions
    ) external;

    /**
     * @notice Claim rewards against the given root read from `_distributionRoots[claim.rootIndex]`.
     * Earnings are cumulative so earners do not have to claim against all distribution roots they have earnings for.
     * They can claim rewards against the latest root and the contract will calculate the difference between
     * their `cumulativeEarnings` and `cumulativeClaimed`. This difference is then transferred to the recipient address.
     * @param claim `RewardsMerkleClaim` to process.
     * Contains the root index, earner, token leaves, and required proofs.
     * @param recipient Recipient address to get ERC20 rewards.
     * @dev Only callable by the valid claimer:
     * If `claimerFor[claim.earner]` is `address(0)`, only the earner can claim the rewards.
     * Otherwise, only `claimerFor[claim.earner]`.
     */
    function processClaim(RewardsMerkleClaim calldata claim, address recipient) external;

    /**
     * @notice Batch claim rewards against the given root read from `_distributionRoots[claim.rootIndex]`.
     * Earnings are cumulative so earners do not have to claim against all distribution roots they have earnings for.
     * They can claim rewards against the latest root and the contract will calculate the difference between
     * their `cumulativeEarnings` and `cumulativeClaimed`. This difference is then transferred to the recipient address.
     * @param claims `RewardsMerkleClaims` to process.
     * Contains the root index, earner, token leaves, and required proofs.
     * @param recipient Recipient address to get ERC20 rewards.
     * @dev Only callable by the valid claimer:
     * If `claimerFor[claim.earner]` is `address(0)`, only the earner can claim the rewards.
     * Otherwise, only `claimerFor[claim.earner]`.
     * @dev This function may fail to execute with a large number of claims due to gas limits.
     * Use a smaller array of claims if necessary.
     */
    function processClaims(RewardsMerkleClaim[] calldata claims, address recipient) external;

    /**
     * @notice Creates a new distribution root. `activatedAt` is set to `block.timestamp + activationDelay`.
     * @param root Distribution's merkle root.
     * @param rewardsCalculationEndTimestamp Timestamp until which rewards have been calculated.
     * @dev Only callable by the `rewardsUpdater`.
     */
    function submitRoot(bytes32 root, uint32 rewardsCalculationEndTimestamp) external;

    /**
     * @notice Allow the `rewardsUpdater` to disable or cancel a pending root submission in case of an error.
     * @param rootIndex Index of the root to be disabled.
     */
    function disableRoot(uint32 rootIndex) external;

    /**
     * @notice Sets the address of the entity that can call `processClaim` on ehalf of an earner.
     * @param claimer Address of the entity that can call `processClaim` on behalf of the earner.
     * @dev Assumes `msg.sender` is the earner.
     */
    function setClaimerFor(address claimer) external;

    /**
     * @notice Sets the address of the entity that can call `processClaim` on behalf of an earner.
     * @param earner Address for setting the claimer.
     * @param claimer Address of the entity that can call `processClaim` on behalf of the earner.
     * @dev Only callable by operators or AVSs. We define an AVS that has created at least one
     * operatorSet in the `AllocationManager`.
     */
    function setClaimerFor(address earner, address claimer) external;

    /**
     * @notice Sets the delay in the timestamp before a posted root can be claimed against.
     * @dev Only callable by the contract owner.
     * @param _activationDelay New value for `activationDelay`.
     */
    function setActivationDelay(uint32 _activationDelay) external;

    /**
     * @notice Sets the default split for all operators across all AVSs.
     * @param split Default split for all operators across all AVSs in bips.
     * @dev Only callable by the contract owner.
     */
    function setDefaultOperatorSplit(uint16 split) external;

    /**
     * @notice Sets the split for a specific AVS' operator.
     * @param operator Operator setting the split.
     * @param avs AVS for which the split is being set by the operator.
     * @param split Split for the operator for the specific AVS in bips.
     * @dev Only callable by the operator.
     * @dev Split has to be between 0 and 10000 bips.
     * @dev Split will be activated after the activation delay.
     */
    function setOperatorAVSSplit(address operator, address avs, uint16 split) external;

    /**
     * @notice Sets the split for a specific operator for Programmatic Incentives.
     * @param operator Operator on behalf of which the split is being set.
     * @param split Split for the operator for Programmatic Incentives in bips.
     * @dev Only callable by the operator.
     * @dev Split has to be between 0 and 10000 bips.
     * @dev Split will be activated after the activation delay.
     */
    function setOperatorPISplit(address operator, uint16 split) external;

    /**
     * @notice Sets the split for a specific `operatorSet`'s operator.
     * @param operator Operator setting the split.
     * @param operatorSet `operatorSet` for which the split is being set by the operator.
     * @param split Split for the specific `operatorSet`'s operator in bips.
     * @dev Only callable by the operator.
     * @dev Split has to be between 0 and 10000 bips.
     * @dev Split will be activated after the activation delay.
     */
    function setOperatorSetSplit(
        address operator,
        OperatorSet calldata operatorSet,
        uint16 split
    ) external;

    /**
     * @notice Sets the permissioned `rewardsUpdater` address which can post new roots.
     * @dev Only callable by the contract owner.
     * @param _rewardsUpdater New `rewardsUpdater`'s address.
     */
    function setRewardsUpdater(address _rewardsUpdater) external;

    /**
     * @notice Sets the permissioned `rewardsForAllSubmitter` address which can submit `createRewardsForAllSubmission`.
     * @dev Only callable by the contract owner.
     * @param _submitter `rewardsForAllSubmitter`'s address.
     * @param _newValue `isRewardsForAllSubmitter`'s new value.
     */
    function setRewardsForAllSubmitter(address _submitter, bool _newValue) external;

    /**
     *
     * VIEW FUNCTIONS
     *
     */

    /// @notice Delay in timestamp in seconds before a posted root can be claimed against.
    function activationDelay() external view returns (uint32);

    /// @notice Timestamp until which `RewardsSubmissions` have been calculated.
    function currRewardsCalculationEndTimestamp() external view returns (uint32);

    /// @notice Mapping: `earner => the address of the entity` who can call `processClaim` on behalf of the earner.
    function claimerFor(address earner) external view returns (address);

    /// @notice Mapping: `claimer => token => total amount` claimed.
    function cumulativeClaimed(address claimer, IERC20 token) external view returns (uint256);

    /// @notice Default split for all operators across all AVSs.
    function defaultOperatorSplitBips() external view returns (uint16);

    /// @notice Split for a specific AVS' operator.
    function getOperatorAVSSplit(address operator, address avs) external view returns (uint16);

    /// @notice Split for a Programmatic Incentives' operator.
    function getOperatorPISplit(address operator) external view returns (uint16);

    /// @notice Returns the split for a specific `operatorSet`'s operator.
    function getOperatorSetSplit(
        address operator,
        OperatorSet calldata operatorSet
    ) external view returns (uint16);

    /// @notice Returns the hash of the earner's leaf.
    function calculateEarnerLeafHash(
        EarnerTreeMerkleLeaf calldata leaf
    ) external pure returns (bytes32);

    /// @notice Returns the hash of the earner's token leaf.
    function calculateTokenLeafHash(
        TokenTreeMerkleLeaf calldata leaf
    ) external pure returns (bytes32);

    /// @notice Returns 'true' if the claim would currently pass the check in `processClaims`
    /// but will revert if invalid.
    function checkClaim(RewardsMerkleClaim calldata claim) external view returns (bool);

    /// @notice Returns the number of distribution roots posted.
    function getDistributionRootsLength() external view returns (uint256);

    /// @notice Returns the `distributionRoot` at the specified index.
    function getDistributionRootAtIndex(
        uint256 index
    ) external view returns (DistributionRoot memory);

    /// @notice Returns the current `distributionRoot`.
    function getCurrentDistributionRoot() external view returns (DistributionRoot memory);

    /// @notice Loops through the distribution roots from reverse and get latest root that is not disabled and activated
    /// i.e. a root that can be claimed against.
    function getCurrentClaimableDistributionRoot() external view returns (DistributionRoot memory);

    /// @notice Loops through distribution roots from the reverse and return an index from the hash.
    function getRootIndexFromHash(bytes32 rootHash) external view returns (uint32);

    /// @notice Address of the entity that can update the contract with new merkle roots.
    function rewardsUpdater() external view returns (address);

    /**
     * @notice Interval in seconds at which the calculation for a `RewardsSubmission` distribution is done.
     * @dev Reward submission durations must be multiplied in this interval.
     */
    function CALCULATION_INTERVAL_SECONDS() external view returns (uint32);

    /// @notice Maximum amount of time in seconds that a `RewardsSubmission` can span over.
    function MAX_REWARDS_DURATION() external view returns (uint32);

    /// @notice Maximum amount of time in seconds that a submission could start in the past.
    function MAX_RETROACTIVE_LENGTH() external view returns (uint32);

    /// @notice Maximum amount of time in seconds that a submission can start in the future.
    function MAX_FUTURE_LENGTH() external view returns (uint32);

    /// @notice Absolute minimum timestamp in seconds that a submission can start at.
    function GENESIS_REWARDS_TIMESTAMP() external view returns (uint32);
}
