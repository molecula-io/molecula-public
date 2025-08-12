/**
 * Link to the original contract:
 * https://github.com/Layr-Labs/eigenlayer-contracts/blob/main/src/contracts/interfaces/IEigenPodManager.sol
 */
// SPDX-License-Identifier: BUSL-1.1
pragma solidity >=0.5.0;

import "@openzeppelin/contracts/proxy/beacon/IBeacon.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./IEigenPod.sol";
import "./IETHPOSDeposit.sol";
import "./IStrategy.sol";

interface IEigenPodManagerTypes {
    /**
     * @notice The amount of beacon chain slashing experienced by a pod owner as a proportion of WAD
     * @param isSet whether the slashingFactor has ever been updated. Used to distinguish between
     * a value of "0" and an uninitialized value.
     * @param slashingFactor the proportion of the pod owner's balance that has been decreased due to
     * slashing or other beacon chain balance decreases.
     * @dev NOTE: if !isSet, `slashingFactor` should be treated as WAD. `slashingFactor` is monotonically
     * decreasing and can hit 0 if fully slashed.
     */
    struct BeaconChainSlashingFactor {
        bool isSet;
        uint64 slashingFactor;
    }
}

/**
 * @title Interface for factory that creates and manages solo staking pods that have their withdrawal credentials pointed to EigenLayer.
 * @author Layr Labs, Inc.
 * @notice Terms of Service: https://docs.eigenlayer.xyz/overview/terms-of-service
 */
interface IEigenPodManager is IEigenPodManagerTypes {
    /**
     * @notice Creates an EigenPod for the sender.
     * @dev Function will revert if the `msg.sender` already has an EigenPod.
     * @dev Returns EigenPod address
     */
    function createPod() external returns (address);

    /**
     * @notice Stakes for a new beacon chain validator on the sender's EigenPod.
     * Also creates an EigenPod for the sender if they don't have one already.
     * @param pubkey The 48 bytes public key of the beacon chain validator.
     * @param signature The validator's signature of the deposit data.
     * @param depositDataRoot The root/hash of the deposit data for the validator's deposit.
     */
    function stake(
        bytes calldata pubkey,
        bytes calldata signature,
        bytes32 depositDataRoot
    ) external payable;

    /**
     * @notice Adds any positive share delta to the pod owner's deposit shares, and delegates them to the pod
     * owner's operator (if applicable). A negative share delta does NOT impact the pod owner's deposit shares,
     * but will reduce their beacon chain slashing factor and delegated shares accordingly.
     * @param podOwner is the pod owner whose balance is being updated.
     * @param prevRestakedBalanceWei is the total amount restaked through the pod before the balance update, including
     * any amount currently in the withdrawal queue.
     * @param balanceDeltaWei is the amount the balance changed
     * @dev Callable only by the podOwner's EigenPod contract.
     * @dev Reverts if `sharesDelta` is not a whole Gwei amount
     */
    function recordBeaconChainETHBalanceUpdate(
        address podOwner,
        uint256 prevRestakedBalanceWei,
        int256 balanceDeltaWei
    ) external;

    /// @notice Sets the address that can set proof timestamps
    function setProofTimestampSetter(address newProofTimestampSetter) external;

    /// @notice Sets the Pectra fork timestamp, only callable by `proofTimestampSetter`
    function setPectraForkTimestamp(uint64 timestamp) external;

    /// @notice Returns the address of the `podOwner`'s EigenPod if it has been deployed.
    function ownerToPod(address podOwner) external view returns (IEigenPod);

    /// @notice Returns the address of the `podOwner`'s EigenPod (whether it is deployed yet or not).
    function getPod(address podOwner) external view returns (IEigenPod);

    /// @notice The ETH2 Deposit Contract
    function ethPOS() external view returns (IETHPOSDeposit);

    /// @notice Beacon proxy to which the EigenPods point
    function eigenPodBeacon() external view returns (IBeacon);

    /// @notice Returns 'true' if the `podOwner` has created an EigenPod, and 'false' otherwise.
    function hasPod(address podOwner) external view returns (bool);

    /// @notice Returns the number of EigenPods that have been created
    function numPods() external view returns (uint256);

    /**
     * @notice Mapping from the Pod owner owner to the number of shares they have in the virtual beacon chain ETH strategy.
     * @dev Share amount can become negative. This is necessary as the pod owner's virtual beacon
     * chain ETH shares can decrease between queuing and withdrawal completion. When the pod
     * owner's shares increase, this deficit is decreased first instead. Likewise, when a withdrawal
     * is completed, this deficit is decreased, and the withdrawal amount is decreased;
     * We can think of this as the withdrawal paying off the deficit.
     */
    function podOwnerDepositShares(address podOwner) external view returns (int256);

    /**
     * @notice Mapping from the Pod owner owner to the number of shares they have in the virtual beacon chain ETH strategy.
     * @dev Share amount can become negative. This is necessary as the pod owner's virtual beacon
     * chain ETH shares can decrease between queuing and withdrawal completion. When the pod
     * owner's shares increase, this deficit is decreased first instead. Likewise, when a withdrawal
     * is completed, this deficit is decreased, and the withdrawal amount is decreased;
     * We can think of this as the withdrawal paying off the deficit.
     */
    function podOwnerShares(address podOwner) external view returns (int256);

    /// @notice returns canonical, virtual beaconChainETH strategy
    function beaconChainETHStrategy() external view returns (IStrategy);

    /**
     * @notice Returns the historical sum of proportional balance decreases a pod owner has experienced when
     * updating their pod's balance.
     */
    function beaconChainSlashingFactor(address staker) external view returns (uint64);

    /// @notice Returns the accumulated amount of beacon chain ETH Strategy shares
    function burnableETHShares() external view returns (uint256);

    /// @notice Returns the timestamp of the Pectra hard fork
    /// @dev Specifically, this returns the timestamp of the first non-missed slot at or after the Pectra hard fork
    function pectraForkTimestamp() external view returns (uint64);
}
