// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.28;

import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {Guardian} from "./../../common/pausable/Guardian.sol";
import {ConstantsCoreV2} from "./../../coreV2/Constants.sol";
import {IERC7575} from "./../../coreV2/external/interfaces/IERC7575.sol";
import {IMoleculaPoolV2} from "./../../coreV2/interfaces/IMoleculaPoolV2.sol";
import {DepositManagerStorage, IDelegationManager, IStrategyFactory} from "./DepositManagerStorage.sol";
import {IEigenPodManager} from "./external/interfaces/IEigenPodManager.sol";
import {IStrategy, IStrategyManager} from "./external/interfaces/IStrategyManager.sol";
import {IWETH} from "./external/interfaces/IWETH.sol";
import {IBufferInteractor} from "./interfaces/IBufferInteractor.sol";
import {IDelegator} from "./interfaces/IDelegator.sol";
import {IDepositManager, BeaconChainProofs, IMoleculaPoolV2WithNativeToken, IStrategyLib} from "./interfaces/IDepositManager.sol";

/**
 * @title Deposit Manager
 * @notice Manages deposits, withdrawals, and Pool operations for the mrETH protocol.
 * @dev This contract handles:
 * - Deposit and withdrawal of ETH, WETH, and other tokens.
 * - Pool management and rebalancing.
 * - Operator delegation and staking.
 * - Buffer management for maintaining liquidity.
 */
contract DepositManager is
    DepositManagerStorage,
    IDepositManager,
    Ownable2Step,
    Initializable,
    Guardian
{
    using SafeERC20 for IERC20;
    using Address for address;
    using Clones for address;

    /**
     * @dev Ensures the staking functionality is not paused.
     * @custom:revert EStakePaused Check if staking is currently paused.
     */
    modifier stakeNotPaused() {
        if (isStakePaused) {
            revert EStakePaused();
        }
        _;
    }

    /**
     * @dev Initializes the DepositManager contract with required addresses and configurations.
     * @param initialOwner_ Address that will own the contract.
     * @param authorizedStaker_ Address authorized to perform staking operations.
     * @param guardian_ Address that can pause the contract.
     * @param supplyManager_ Supply Manager contract's address.
     * @param weth_ Wrapped ETH contract's address.
     * @param strategyFactory_ Strategy Factory contract's address.
     * @param delegationManager_ Delegation Manager contract's address.
     * @param delegatorImplementation_ Delegator implementation contract's address.
     * @custom:revert Check if any of the addresses is zero.
     */
    constructor(
        address initialOwner_,
        address authorizedStaker_,
        address guardian_,
        address supplyManager_,
        address weth_,
        address strategyFactory_,
        address delegationManager_,
        address delegatorImplementation_
    )
        notZeroAddress(authorizedStaker_)
        notZeroAddress(supplyManager_)
        notZeroAddress(weth_)
        notZeroAddress(strategyFactory_)
        notZeroAddress(delegationManager_)
        notZeroAddress(delegatorImplementation_)
        Ownable(initialOwner_)
        Guardian(guardian_)
    {
        authorizedStaker = authorizedStaker_;
        SUPPLY_MANAGER = supplyManager_;
        WETH = weth_;
        STRATEGY_FACTORY = IStrategyFactory(strategyFactory_);
        DELEGATION_MANAGER = IDelegationManager(delegationManager_);
        delegatorImplementation = delegatorImplementation_;
    }

    /// @inheritdoc IDepositManager
    function initialize(
        uint16 bufferPercent_,
        address[] calldata pools_,
        PoolData[] calldata poolData_,
        bool[] calldata auth_
    ) external onlyOwner initializer {
        // Set initial buffer percentage.
        _checkPercentage(bufferPercent_);
        bufferPercentage = bufferPercent_;

        _setPools(pools_, poolData_, auth_);
    }

    /// @inheritdoc IMoleculaPoolV2
    function deposit(
        uint256,
        address token,
        address vault,
        uint256 value
    ) external only(SUPPLY_MANAGER) returns (uint256 moleculaTokenAssets) {
        // Transfer tokens from the Vault to this contract.
        // slither-disable-next-line arbitrary-send-erc20
        IERC20(token).safeTransferFrom(vault, address(this), value);

        if (token == WETH) {
            // Deposit WETH into the configured Pools.
            _depositIntoPools(value);
        } else {
            // For non-WETH tokens, delegate to an operator.
            address delegator = chooseDelegatorForDeposit();
            IERC20(token).forceApprove(delegator, value);

            // Delegate deposited LRT tokens for the chosen operator.
            IDelegator(delegator).stakeToken(getStrategy(token), IERC20(token), value);
        }

        // Emit the request deposit event.
        emit Deposit(token, vault, value);

        return _convertTokenToETH(getStrategy(token), value);
    }

    /// @inheritdoc IMoleculaPoolV2WithNativeToken
    function depositNativeToken(
        uint256,
        address,
        address,
        uint256
    ) external payable only(SUPPLY_MANAGER) returns (uint256 moleculaTokenAssets) {
        // Convert ETH to WETH and deposit into the Pools.
        IWETH(WETH).deposit{value: msg.value}();
        _depositIntoPools(msg.value);

        return msg.value;
    }

    /// @dev Allows the contract to receive ETH.
    receive() external payable {}

    /// @inheritdoc IDepositManager
    function stakeNative(
        uint256 value,
        bytes calldata pubkey,
        bytes calldata signature,
        bytes32 depositDataRoot
    ) external only(authorizedStaker) {
        // Calculate the buffered supply.
        uint256 bufferedTvl = totalBufferedSupply();

        // Revert if the value is greater than the buffered supply.
        if (value > bufferedTvl) {
            revert ETooHighDepositValue();
        }

        // If the buffer percentage is greater than 0, calculate the maximum value to deposit.
        if (bufferPercentage > 0) {
            unchecked {
                // Calculate the desired allocation to stay in the buffer.
                uint256 desiredAllocationToStayInBuffer = (totalSupply() * bufferPercentage) /
                    ConstantsCoreV2.PERCENTAGE_FACTOR;

                // Check if any value to stake is available.
                if (bufferedTvl < desiredAllocationToStayInBuffer) {
                    revert ENoNeedToStake();
                }

                // Calculate the maximum value to deposit.
                uint256 maxValueToDeposit = bufferedTvl - desiredAllocationToStayInBuffer;

                // Ensure that we can deposit the value.
                if (value > maxValueToDeposit) {
                    revert ETooHighDepositValue();
                }
            }
        }

        // Call to withdraw the value from the Pools.
        _withdrawFromPools(value, bufferedTvl);

        // Convert the WETH amount into ETH.
        IWETH(WETH).withdraw(value);

        // Choose an operator for stake delegation.
        address delegator = chooseDelegatorForDeposit();

        // Delegate the deposited ETH tokens for the chosen operator.
        IDelegator(delegator).stakeNative{value: value}(pubkey, signature, depositDataRoot);

        // Emit the deposit event.
        emit StakeNative(value, pubkey, signature, depositDataRoot);
    }

    /// @inheritdoc IDepositManager
    function verifyWithdrawalCredentials(
        address operator,
        uint64 beaconTimestamp,
        BeaconChainProofs.StateRootProof calldata stateRootProof,
        uint40[] calldata validatorIndices,
        bytes[] calldata validatorFieldsProofs,
        bytes32[][] calldata validatorFields
    ) external only(authorizedStaker) stakeNotPaused {
        address delegator = operatorsDelegators[operator].delegator;

        IDelegator(delegator).verifyWithdrawalCredentials(
            beaconTimestamp,
            stateRootProof,
            validatorIndices,
            validatorFieldsProofs,
            validatorFields
        );
    }

    /// @inheritdoc IDepositManager
    function redelegate(
        address oldOperator,
        address newOperator,
        IDelegationManager.SignatureWithExpiry calldata approverSignatureAndExpiry,
        bytes32 approverSalt
    ) external only(authorizedStaker) stakeNotPaused {
        address delegator = operatorsDelegators[oldOperator].delegator;
        IDelegator(delegator).redelegate(newOperator, approverSignatureAndExpiry, approverSalt);
    }

    // TO:DO Add `requestRedeem` and `redeem`.

    /// @inheritdoc IMoleculaPoolV2WithNativeToken
    // solhint-disable-next-line no-empty-blocks
    function grantNativeToken(address receiver, uint256 nativeTokenAmount) external {}

    /// @inheritdoc IMoleculaPoolV2
    // solhint-disable-next-line no-empty-blocks
    function requestRedeem(uint256, address, uint256) external returns (uint256 values) {}

    /// @inheritdoc IDepositManager
    function chooseDelegatorForDeposit() public view stakeNotPaused returns (address) {
        // Get the total restaked TVL and individual operator TVLs.
        (uint256 restakedTvl, uint256[] memory operatorDelegatorTVLs) = totalRestakedSupply();
        // Ensure the Operator list is not empty.
        if (operatorsArray.length == 0) revert EOperatorNotExists();

        // For single operator case, return its delegator directly.
        if (operatorsArray.length == 1) {
            return operatorsDelegators[operatorsArray[0]].delegator;
        }

        // Otherwise, find the operator delegator with the TVL below the threshold.
        uint256 tvlLength = operatorDelegatorTVLs.length;

        for (uint256 i = 0; i < tvlLength; ++i) {
            unchecked {
                // Calculate the target TVL for this operator based on their delegation portion.
                // If the current TVL is below the target, this operator is eligible for more deposits.
                if (
                    operatorDelegatorTVLs[i] <
                    (operatorsDelegators[operatorsArray[i]].delegationPortion * restakedTvl) /
                        ConstantsCoreV2.PERCENTAGE_FACTOR
                ) {
                    return operatorsDelegators[operatorsArray[i]].delegator;
                }
            }
        }

        // If all operators are at or above their target TVL, use the first operator.
        return operatorsDelegators[operatorsArray[0]].delegator;
    }

    /// @inheritdoc IDepositManager
    function getStrategy(address token) public view returns (IStrategy strategy) {
        if (address(strategies[token].strategy) == address(0)) {
            return STRATEGY_FACTORY.deployedStrategies(IERC20(token));
        }
        return strategies[token].strategy;
    }

    /// @inheritdoc IDepositManager
    function getWithdrawalCredentials(address delegator) external view returns (bytes memory) {
        return
            abi.encodePacked(
                bytes1(0x01),
                bytes11(0),
                DELEGATION_MANAGER.eigenPodManager().getPod(delegator)
            );
    }

    /// @inheritdoc IDepositManager
    function totalSupply() public view returns (uint256) {
        (uint256 restakedTvl, ) = totalRestakedSupply();
        return totalBufferedSupply() + restakedTvl;
    }

    /**
     * @dev Calculates total buffered supply including the yield from LP tokens.
     * @return bufferedTvl Total ETH supply in the buffer.
     */
    function totalBufferedSupply() public view returns (uint256 bufferedTvl) {
        uint256 length = poolsArray.length;

        // Gets all withdrawable tokens from LP.
        for (uint256 i = 0; i < length; ++i) {
            address pool = poolsArray[i];
            PoolData memory _poolData = poolData[pool];

            bufferedTvl += IBufferInteractor(_poolData.poolLib).getEthBalance(
                pool,
                _poolData.poolToken,
                address(this)
            );
        }
    }

    /// @inheritdoc IDepositManager
    function totalRestakedSupply()
        public
        view
        virtual
        returns (uint256 restakedTvl, uint256[] memory operatorDelegatorTVLs)
    {
        // Get strategy manager contract.
        IStrategyManager strategyManager = DELEGATION_MANAGER.strategyManager();

        // Initialize an array to store the TVL for each operator.
        uint256 operatorsLength = operatorsArray.length;
        operatorDelegatorTVLs = new uint256[](operatorsLength);

        for (uint256 i = 0; i < operatorsLength; ++i) {
            address delegator = operatorsDelegators[operatorsArray[i]].delegator;

            // Gets all deposited strategies.
            // slither-disable-next-line unused-return
            (IStrategy[] memory _strategies, ) = strategyManager.getDeposits(delegator);

            // Length of the `strategies` array.
            uint256 strategiesLength = _strategies.length;

            // TVL in ETH delegated to the chosen operator.
            uint256 operatorEthBalance = 0;

            // Get all withdrawable tokens' amount from the EigenLayer's operator converted to ETH.
            for (uint256 j = 0; j < strategiesLength; ++j) {
                uint256 stakedAmount = _strategies[j].userUnderlyingView(delegator);
                operatorEthBalance += _convertTokenToETH(_strategies[j], stakedAmount);
            }

            // Get the value of the native ETH staked.
            IEigenPodManager eigenPodManager = DELEGATION_MANAGER.eigenPodManager();

            // Get withdrawable amount of restaked ETH.
            int256 podOwnerShares = eigenPodManager.podOwnerDepositShares(delegator);
            uint256 pendingNativeSupply = IDelegator(delegator).totalPendingNativeSupply();

            // Handle the case of negative pod owner shares.
            if (podOwnerShares < 0) {
                // If the pending supply is greater than negative shares, add the difference.
                if (pendingNativeSupply > uint256(-podOwnerShares)) {
                    unchecked {
                        operatorEthBalance += pendingNativeSupply - uint256(-podOwnerShares);
                    }
                }
            } else {
                // For positive shares, add both the pending supply and shares.
                operatorEthBalance += pendingNativeSupply + uint256(podOwnerShares);
            }

            // Add this operator's TVL to total and store in the array.
            restakedTvl += operatorEthBalance;
            operatorDelegatorTVLs[i] = operatorEthBalance;
        }
    }

    /// @inheritdoc IDepositManager
    function addOperator(
        address operator,
        bytes32 salt,
        IDelegationManager.SignatureWithExpiry calldata approverSignatureAndExpiry,
        bytes32 approverSalt,
        address[] calldata newOperatorsArray,
        uint64[] calldata newDelegationPortions
    ) external notZeroAddress(operator) {
        // Check if the operator is already added.
        if (operatorsDelegators[operator].delegationPortion > 0) {
            revert EOperatorExists();
        }

        address predictedAddress = delegatorImplementation.predictDeterministicAddress(salt);

        // Check if the contract is already deployed at the expected address.
        if (predictedAddress.code.length != 0) {
            revert EContractAlreadyExists();
        }

        // Deploy the minimal proxy clone for the delegatorImplementation contract.
        address cloneAddress = delegatorImplementation.cloneDeterministic(salt);

        // Check if the contract is deployed at the expected address.
        if (predictedAddress != cloneAddress) {
            revert EIncorrectPredictedAddress();
        }

        // Store operator and delegator.
        operatorsDelegators[operator].delegator = cloneAddress;
        operatorsArray.push(operator);

        // Set the delegation portions for each operator in the system.
        setOperatorsPortions(newOperatorsArray, newDelegationPortions);

        // Initialize a clone.
        IDelegator(cloneAddress).initialize(
            DELEGATION_MANAGER,
            operator,
            approverSignatureAndExpiry,
            approverSalt
        );
    }

    /// @inheritdoc IDepositManager
    function removeOperator(
        address operator,
        address[] calldata newOperatorsArray,
        uint64[] calldata newDelegationPortions
    ) external {
        address delegator = operatorsDelegators[operator].delegator;

        // Ensure the delegator has no active stake before removal.
        if (DELEGATION_MANAGER.delegatedTo(delegator) != address(0)) {
            revert EDelegatorHasActiveStake();
        }

        // Get the current number of operators.
        uint256 length = operatorsArray.length;

        // Find and remove the operator from the array.
        for (uint256 i = 0; i < length; ++i) {
            if (operatorsArray[i] == operator) {
                operatorsDelegators[operator].delegationPortion = 0;
                operatorsArray[i] = operatorsArray[length - 1];
                // slither-disable-next-line costly-loop
                operatorsArray.pop();
            }
        }

        // Update the delegation portions for the remaining operators.
        setOperatorsPortions(newOperatorsArray, newDelegationPortions);
    }

    /// @inheritdoc IDepositManager
    function setOperatorsPortions(
        address[] calldata newOperatorsArray,
        uint64[] calldata delegationPortions
    ) public onlyOwner {
        uint256 length = operatorsArray.length;

        if (delegationPortions.length != length || newOperatorsArray.length != length) {
            revert EIncorrectLength();
        }

        uint256 portionsSum = 0;

        for (uint256 i = 0; i < length; ++i) {
            portionsSum += delegationPortions[i];
            operatorsArray[i] = newOperatorsArray[i];
            operatorsDelegators[newOperatorsArray[i]].delegationPortion = delegationPortions[i];
        }

        // `portionsSum` must be equal to 100%.
        if (portionsSum != ConstantsCoreV2.PERCENTAGE_FACTOR) {
            revert EWrongPortion();
        }
    }

    /// @inheritdoc IDepositManager
    function addStrategies(
        address[] calldata tokens,
        IStrategy[] calldata newStrategies,
        IStrategyLib[] calldata strategyLibraries
    ) external {
        uint256 length = tokens.length;

        if (length != newStrategies.length) {
            revert EIncorrectLength();
        }

        for (uint256 i = 0; i < length; ++i) {
            // Set the strategy data.
            addStrategy(tokens[i], newStrategies[i], strategyLibraries[i]);
        }
    }

    /// @inheritdoc IDepositManager
    function addStrategy(
        address token,
        IStrategy newStrategy,
        IStrategyLib strategyLibrary
    ) public onlyOwner notZeroAddress(token) {
        // Set the strategy data for interacting with EigenLayer and converting balance of token into ETH.
        strategies[token] = StrategyData(newStrategy, strategyLibrary);

        // Get stored strategy for validation.
        IStrategy strategy = getStrategy(token);

        // Get the strategy manager contract.
        IStrategyManager strategyManager = DELEGATION_MANAGER.strategyManager();

        // Validate that the strategy's underlying token matches the Vault's token
        // and that the strategy is whitelisted for deposits.

        if (address(strategy.underlyingToken()) != token) {
            revert EInvalidStrategyConfiguration("Underlying token mismatch");
        }

        if (!strategyManager.strategyIsWhitelistedForDeposit(strategy)) {
            revert EInvalidStrategyConfiguration("Strategy not whitelisted");
        }
    }

    /// @inheritdoc IDepositManager
    function setPools(
        address[] calldata pools,
        PoolData[] calldata newPoolsData,
        bool[] calldata auth
    ) external onlyOwner {
        uint256 balanceEthToRebalance = _setPools(pools, newPoolsData, auth);
        _rebalanceBuffer(newPoolsData, balanceEthToRebalance);
    }

    /**
     * @dev Sets configuration for a single Pool.
     * @param pool Pool's address.
     * @param newPoolData New Pool's configuration.
     * @param auth Details on whether to add or remove the Pool.
     * @return balanceEthToRebalance Amount of ETH to rebalance.
     */
    function _setPool(
        address pool,
        PoolData memory newPoolData,
        bool auth
    ) internal returns (uint256 balanceEthToRebalance) {
        if (auth) {
            if (poolData[pool].poolPortion == 0) {
                poolsArray.push(pool);
            }

            poolData[pool] = newPoolData;
        } else {
            PoolData memory _poolData = poolData[pool];

            poolsArray[_poolData.poolId] = poolsArray[poolsArray.length - 1];
            // slither-disable-next-line costly-loop
            poolsArray.pop();

            // Get the Pool's balance.
            balanceEthToRebalance = IBufferInteractor(_poolData.poolLib).getEthBalance(
                pool,
                _poolData.poolToken,
                address(this)
            );

            // Withdraws the deleted Pool's balance.
            _executeWithdraw(pool, balanceEthToRebalance);

            delete poolData[pool];
        }
    }

    /**
     * @dev Authorizes new Pools.
     * @param pools actual Array with Pools' addresses.
     * @param newPoolsData Array of new Pools' data.
     * @param auth Array of boolean flags indicating for adding or removing the Pool.
     * @return balanceEthToRebalance Total amount of ETH withdrawn from the LPs.
     */
    function _setPools(
        address[] memory pools,
        PoolData[] memory newPoolsData,
        bool[] memory auth
    ) internal returns (uint256 balanceEthToRebalance) {
        // Length of a new `poolsArray`.
        uint256 length = pools.length;

        // Validate the length of `newPoolsData`.
        if (length != newPoolsData.length || length != auth.length) {
            revert EIncorrectLength();
        }

        uint256 portionsSum = 0;

        for (uint256 i = 0; i < length; ++i) {
            balanceEthToRebalance += _setPool(pools[i], newPoolsData[i], auth[i]);

            portionsSum += newPoolsData[i].poolPortion;

            // `poolId` must match the position in the array.
            if (newPoolsData[i].poolId != i) {
                revert EWrongPoolId();
            }
        }

        // `portionsSum` must be equal to 100%.
        if (portionsSum != ConstantsCoreV2.PERCENTAGE_FACTOR) {
            revert EWrongPortion();
        }
    }

    /// @inheritdoc IDepositManager
    function rebalanceBuffer(PoolData[] calldata newPoolsData) external onlyOwner {
        _rebalanceBuffer(newPoolsData, 0);
    }

    /**
     * @dev Rebalances the buffer with new Pool configurations and extra value.
     * @param newPoolsData Array of new Pool configurations.
     * @param extraValue Additional value to consider in rebalancing.
     */
    function _rebalanceBuffer(PoolData[] calldata newPoolsData, uint256 extraValue) internal {
        // Length of a new `poolsArray`.
        uint256 length = poolsArray.length;

        // Calculate the buffer TVL.
        uint256 bufferTvl = extraValue + totalSupply();

        // Create arrays for the rebalance calculation.
        uint256[] memory expectedPoolsBalances = new uint256[](length);
        uint256[] memory actualPoolsBalances = new uint256[](length);

        for (uint256 i = 0; i < length; ++i) {
            address pool = poolsArray[i];

            // Rewrite the new `poolData`.
            poolData[pool] = newPoolsData[i];

            unchecked {
                // Calculate the amount to deposit to the Pool by distribution deposit portions.
                expectedPoolsBalances[i] =
                    (bufferTvl * newPoolsData[i].poolPortion) /
                    ConstantsCoreV2.PERCENTAGE_FACTOR;
            }

            actualPoolsBalances[i] = IBufferInteractor(newPoolsData[i].poolLib).getEthBalance(
                pool,
                newPoolsData[i].poolToken,
                address(this)
            );

            // Withdraw extra balance of the Pool.
            if (actualPoolsBalances[i] > expectedPoolsBalances[i]) {
                _executeWithdraw(pool, actualPoolsBalances[i] - expectedPoolsBalances[i]);
            }
        }

        // Deposit into Pools after withdrawing all extra balances.
        for (uint256 i = 0; i < length; ++i) {
            if (expectedPoolsBalances[i] > actualPoolsBalances[i]) {
                _executeDeposit(poolsArray[i], expectedPoolsBalances[i] - actualPoolsBalances[i]);
            }
        }
    }

    /**
     * @dev Deposits funds into Pools according to their portions.
     * @param value Total amount to deposit.
     */
    function _depositIntoPools(uint256 value) internal {
        uint256 length = poolsArray.length;

        // If only one Pool exists, deposit all the value without calculations.
        if (length == 1) {
            return _executeDeposit(poolsArray[0], value);
        }

        // Track total amount distributed to ensure accurate distribution.
        uint256 distributedAmount = 0;

        // Distribute deposits across all Pools based on their portions.
        for (uint256 i = 0; i < length; ++i) {
            PoolData memory _poolData = poolData[poolsArray[i]];

            if (_poolData.poolPortion > 0) {
                uint256 depositValue;
                unchecked {
                    if (i != length - 1) {
                        // Calculate the amount to deposit to the Pool by distribution of the deposit portions.
                        depositValue =
                            (value * _poolData.poolPortion) /
                            ConstantsCoreV2.PERCENTAGE_FACTOR;
                    } else {
                        // If it's the last Pool, deposit the entire remaining value.
                        depositValue = value - distributedAmount;
                    }

                    // Update the total distributed amount.
                    distributedAmount += depositValue;
                }
                // Call the Pool to deposit the value.
                _executeDeposit(poolsArray[i], depositValue);
            }
        }
    }

    /**
     * @dev Withdraws funds from the Pools according to their portions.
     * @param value Total amount to withdraw.
     * @param bufferedTvl Total ETH supply in the buffer.
     */
    function _withdrawFromPools(uint256 value, uint256 bufferedTvl) internal {
        uint256 length = poolsArray.length;

        // If only one Pool exists, withdraw all the value without calculations.
        if (length == 1) {
            return _executeWithdraw(poolsArray[0], value);
        }

        // Track the total amount withdrawn to ensure accurate distribution.
        uint256 withdrawnAmount = 0;

        // Withdraw from Pools while maintaining their relative portions.
        for (uint256 i = 0; i < length; ++i) {
            // Get the current pool address and its configuration.
            address pool = poolsArray[i];
            PoolData memory _poolData = poolData[pool];

            if (_poolData.poolPortion > 0) {
                uint256 amountToWithdraw;

                // Get the Pool TVL for portion withdrawal calculations.
                uint256 poolTvl = IBufferInteractor(_poolData.poolLib).getEthBalance(
                    pool,
                    _poolData.poolToken,
                    address(this)
                );

                unchecked {
                    if (i != length - 1) {
                        // Calculate the amount to withdraw to maintain Pool portions.
                        amountToWithdraw =
                            poolTvl -
                            ((_poolData.poolPortion * (bufferedTvl - value)) /
                                ConstantsCoreV2.PERCENTAGE_FACTOR);
                    } else {
                        // If it's the last Pool, withdraw the entire remaining value.
                        amountToWithdraw = value - withdrawnAmount;
                    }

                    // Update the total withdrawn amount.
                    withdrawnAmount += amountToWithdraw;
                }

                // Call the Pool to withdraw the value.
                _executeWithdraw(poolsArray[i], amountToWithdraw);
            }
        }
    }

    /**
     * @dev Executes a deposit into a Pool.
     * @param pool Address of the Pool.
     * @param value Amount to Deposit.
     */
    function _executeDeposit(address pool, uint256 value) internal {
        // Approve WETH to the Pool.
        IERC20(WETH).forceApprove(pool, value);

        // Get `calldata` for deposit into the Pool.
        bytes memory data = IBufferInteractor(poolData[pool].poolLib).encodeSupply(
            WETH,
            address(this),
            value
        );

        // slither-disable-next-line unused-return
        pool.functionCall(data);
    }

    /**
     * @dev Executes a withdrawal from a Pool.
     * @param pool Pool's address.
     * @param value Amount to withdraw.
     */
    function _executeWithdraw(address pool, uint256 value) internal {
        // Get `calldata` for withdrawal from the Pool.
        bytes memory data = IBufferInteractor(poolData[pool].poolLib).encodeWithdraw(
            WETH,
            address(this),
            value
        );
        // slither-disable-next-line unused-return
        pool.functionCall(data);
    }

    /// @inheritdoc IMoleculaPoolV2
    function addTokenVault(address tokenVault) external view {
        _validateTokenVault(tokenVault);
    }

    /// @inheritdoc IMoleculaPoolV2
    function removeTokenVault(address tokenVault) external view {
        _validateTokenVault(tokenVault);
    }

    /**
     * @dev Validates that a token Vault is properly configured for the system.
     * @param tokenVault Address of the token vault to validate.
     */
    function _validateTokenVault(address tokenVault) internal view only(SUPPLY_MANAGER) {
        address token = IERC7575(tokenVault).asset();

        //TO:DO Add checks for the restaked zero balance or remove restaked balance for the deleted token.
        // Validate that a strategy exists for the token Vault's value.
        // Skip the check for WETH and ETH, as they have a different flow than LRT.
        if (
            address(getStrategy(token)) == address(0) &&
            token != WETH &&
            token != ConstantsCoreV2.NATIVE_TOKEN
        ) {
            revert EStrategyNotExists();
        }
    }

    /**
     * @dev Validate Percentage.
     * @param percentage All needed percentages.
     */
    function _checkPercentage(uint16 percentage) internal pure {
        if (percentage > ConstantsCoreV2.PERCENTAGE_FACTOR) {
            revert EInvalidPercentage();
        }
    }

    /**
     * @dev Converter token balance to ETH.
     * @param value Amount of tokens to convert.
     * @param strategy Strategy contract's address.
     * @return convertedValueToETH Amount of ETH converted from the token value.
     */
    function _convertTokenToETH(IStrategy strategy, uint256 value) internal view returns (uint256) {
        IStrategyLib strategyLib = strategies[address(strategy)].strategyLib;

        return address(strategyLib) != address(0) ? strategyLib.getEthBalance(value) : value;
    }

    /// @inheritdoc IDepositManager
    function setBufferPercentage(uint16 newBufferPercentage) external onlyOwner {
        _checkPercentage(newBufferPercentage);
        bufferPercentage = newBufferPercentage;
    }

    /// @inheritdoc IDepositManager
    function setDelegatorImplementation(
        address newDelegatorImplementation
    ) external onlyOwner notZeroAddress(newDelegatorImplementation) {
        delegatorImplementation = newDelegatorImplementation;
    }

    /// @inheritdoc IDepositManager
    function setAuthorizedStaker(
        address newAuthorizedStaker
    ) external onlyOwner notZeroAddress(newAuthorizedStaker) {
        authorizedStaker = newAuthorizedStaker;
    }

    /// @dev Set a new value for the `isRedeemPaused` flag.
    /// @param newValue New value.
    function _setStakePaused(bool newValue) private {
        if (isStakePaused == newValue) {
            revert EPauseAlreadySet();
        }
        isStakePaused = newValue;
        emit IsStakePausedChanged(newValue);
    }

    /// @inheritdoc IDepositManager
    function pauseStake() external onlyAuthForPause {
        _setStakePaused(true);
    }

    /// @inheritdoc IDepositManager
    function unpauseStake() external onlyOwner {
        _setStakePaused(false);
    }

    /// @inheritdoc Ownable2Step
    function _transferOwnership(address newOwner) internal virtual override(Ownable, Ownable2Step) {
        // Transfer ownership to the new owner.
        super._transferOwnership(newOwner);
    }

    /// @inheritdoc Ownable2Step
    function transferOwnership(address newOwner) public virtual override(Ownable, Ownable2Step) {
        // Initiate ownership transfer.
        super.transferOwnership(newOwner);
    }
}
