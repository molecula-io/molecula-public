// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.30;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {ConstantsCoreV2} from "./../../coreV2/Constants.sol";
import {IERC7575} from "./../../coreV2/external/interfaces/IERC7575.sol";
import {IMoleculaPoolV2, IMoleculaPoolV2WithNativeToken} from "./../../coreV2/interfaces/IMoleculaPoolV2.sol";
import {ISupplyManagerV2, ISupplyManagerV2WithNative} from "./../../coreV2/interfaces/ISupplyManagerV2.sol";
import {IVaultContainer} from "./../../coreV2/Tokens/interfaces/IVaultContainer.sol";
import {DepositManagerBase} from "./DepositManagerBase.sol";
import {DepositManagerStorage, IDelegationManager, IStrategyFactory} from "./DepositManagerStorage.sol";
import {IStrategy} from "./external/interfaces/IStrategyManager.sol";
import {IWETH} from "./external/interfaces/IWETH.sol";
import {IBufferInteractor} from "./interfaces/IBufferInteractor.sol";
import {IDelegator} from "./interfaces/IDelegator.sol";
import {IDepositManagerLib} from "./interfaces/IDepositManagerLib.sol";
import {IDepositManagerPool, IDepositManagerWithImmediateRedeem} from "./interfaces/IDepositManagerPool.sol";
import {IOperationsType} from "./interfaces/IOperationsType.sol";
import {IStrategyLib} from "./interfaces/IStrategyLib.sol";
import {PausableRedeem} from "./pausable/PausableRedeem.sol";
import {PausableStake} from "./pausable/PausableStake.sol";

/**
 * @title Deposit Manager
 * @notice Manages deposits, withdrawals, and Pool operations for the mrETH protocol.
 * @dev This contract handles:
 * - Deposit and withdrawal of ETH, WETH, and other tokens.
 * - Pool management and rebalancing.
 * - Operator delegation and staking.
 * - Buffer management for maintaining liquidity.
 */
contract DepositManagerPool is
    DepositManagerStorage,
    IDepositManagerPool,
    DepositManagerBase,
    Initializable,
    PausableRedeem,
    PausableStake
{
    using SafeERC20 for IERC20;
    using Address for address;
    using Address for address payable;

    /// @dev Validates that the caller is an authorized `TokenVault`.
    modifier onlyTokenVault() {
        // Get the Molecula Token address.
        address moleculaToken = ISupplyManagerV2(SUPPLY_MANAGER).moleculaToken();

        // Validate that the caller is an authorized `TokenVault`.
        IVaultContainer(moleculaToken).validateTokenVault(msg.sender);
        _;
    }

    /**
     * @dev Initializes the `DepositManager` contract with required addresses and configurations.
     * @param initialOwner_ Address that will own the contract.
     * @param supplyManager_ Supply Manager contract's address.
     * @param weth_ Wrapped ETH contract's address.
     * @param strategyFactory_ Strategy Factory contract's address.
     * @param delegationManager_ Delegation Manager contract's address.
     * @param rewardsCoordinator_ Reward Coordinator contract's address.
     * @param depositManagerRestaker_ Deposit Manager Restaker contract's address.
     * @custom:revert Check if any of the addresses is zero.
     */
    constructor(
        address initialOwner_,
        address supplyManager_,
        address weth_,
        address strategyFactory_,
        address delegationManager_,
        address rewardsCoordinator_,
        address depositManagerRestaker_
    )
        notZeroAddress(initialOwner_)
        notZeroAddress(supplyManager_)
        notZeroAddress(weth_)
        notZeroAddress(strategyFactory_)
        notZeroAddress(delegationManager_)
        notZeroAddress(rewardsCoordinator_)
        notZeroAddress(depositManagerRestaker_)
    {
        SUPPLY_MANAGER = supplyManager_;
        WETH = weth_;
        STRATEGY_FACTORY = IStrategyFactory(strategyFactory_);
        DELEGATION_MANAGER = IDelegationManager(delegationManager_);
        REWARDS_COORDINATOR = rewardsCoordinator_;
        DEPOSIT_MANAGER_RESTAKER = depositManagerRestaker_;

        // Grant the DEFAULT_ADMIN_ROLE to the initial owner.
        _grantRole(DEFAULT_ADMIN_ROLE, initialOwner_);
    }

    /// @inheritdoc IDepositManagerPool
    function initialize(
        address delegatorImplementation_,
        address moleculaBuffer_,
        address depositManagerLib_,
        uint16 bufferPercent_,
        SetPoolData[] calldata setPoolData_
    )
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
        initializer
        checkBPS(bufferPercent_)
        notZeroAddress(depositManagerLib_)
        notZeroAddress(delegatorImplementation_)
    {
        config.delegatorImplementation = delegatorImplementation_;
        // Set the Molecula Buffer contract's address.
        _setMoleculaBuffer(moleculaBuffer_);

        // Set the initial percentages.
        config.bufferPercentage = bufferPercent_;

        // Set the external library address.
        config.depositManagerLib = IDepositManagerLib(depositManagerLib_);

        // Set initial Pools.
        _setPools(setPoolData_, setPoolData_.length);
    }

    // ============ STAKE FUNCTIONS ============

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

        // Deposit WETH into the configured Pools.
        // Delegate deposited LRT tokens for the chosen operator.
        _restakeTokens(token, value);

        // Emit a request deposit event.
        emit Deposit(token, vault, value);

        return convertTokenToETH(getStrategy(token), value);
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

        // Deposit the WETH amount into the Pools.
        _depositIntoPools(msg.value);

        // Return the ETH value.
        return msg.value;
    }

    /// @dev Allows the contract to receive ETH.
    receive() external payable {}

    // ============ REDEEM FUNCTIONS ============

    /// @inheritdoc IMoleculaPoolV2
    function requestRedeem(
        uint256 requestId,
        address token,
        address tokenVault,
        uint256 moleculaTokenAssets
    ) external only(SUPPLY_MANAGER) returns (uint256 assets) {
        // Get the redeem operation type.
        IOperationsType.OperationType operationType = IOperationsType(tokenVault).getOperationType(
            requestId
        );

        // Redeem immediately from the Buffer if the operation type is `RedeemFromBuffer`.
        if (operationType == IOperationsType.OperationType.RedeemFromBuffer) {
            // Revert if the token is not a buffered asset.
            if (token != WETH && token != ConstantsCoreV2.NATIVE_TOKEN) {
                revert EUnsupportedRedeemFromBufferToken();
            }

            // Redeem the assets from the Pools.
            _redeemFromBuffer(requestId, moleculaTokenAssets);
            assets = moleculaTokenAssets;
        } else {
            // Redeem the assets from EigenLayer.
            assets = _redeemFromEigenLayer(requestId, token, moleculaTokenAssets);
        }

        // If the token is not a native token, increase the allowance of the token Vault.
        if (token == ConstantsCoreV2.NATIVE_TOKEN) {
            // Convert the WETH amount into ETH.
            IWETH(WETH).withdraw(assets);
        } else {
            // Increase the MetaPoolTreasury's allowance toward `tokenVault` by `assets`.
            IERC20(token).safeIncreaseAllowance(tokenVault, assets);
        }
    }

    /**
     * @dev Redeems from EigenLayer.
     * @param requestId Request ID.
     * @param token Token to redeem.
     * @param tokenAmount Amount of token to redeem.
     * @return assets Amount of assets to redeem.
     */
    function _redeemFromEigenLayer(
        uint256 requestId,
        address token,
        uint256 tokenAmount
    ) internal returns (uint256 assets) {
        address delegator = chooseDelegatorForWithdrawal();
        IStrategy strategy = getStrategy(token);

        // Queue the withdrawal from EigenLayer.
        uint256 sharesToWithdraw = IDelegator(delegator).queueWithdrawal(
            IERC20(token),
            tokenAmount,
            strategy,
            requestId
        );

        // Convert shares into the underlying view.
        assets = strategy.sharesToUnderlyingView(sharesToWithdraw);
    }

    /**
     * @dev Redeems from the Buffer.
     * @param requestId Request ID.
     * @param value Value to redeem.
     */
    function _redeemFromBuffer(uint256 requestId, uint256 value) internal {
        // Get the total buffered supply.
        (uint256 bufferedTvl, uint256[] memory bufferedTvls) = totalBufferedSupply();

        // Withdraw the assets from the Pools.
        _withdrawFromPools(value, bufferedTvl, bufferedTvls);

        // Emit a redeem event.
        emit RedeemFromBuffer(requestId, value);
    }

    /// @inheritdoc IDepositManagerWithImmediateRedeem
    function fulfillRedeemImmediately(
        uint256[] calldata requestIds
    ) external checkNotPause(_REDEEM_SELECTOR) onlyTokenVault {
        // Fulfill the redeem request for WETH.
        // slither-disable-next-line unused-return
        ISupplyManagerV2(SUPPLY_MANAGER).fulfillRedeemRequests(address(this), requestIds);
    }

    /// @inheritdoc IDepositManagerWithImmediateRedeem
    function fulfillRedeemImmediatelyForNativeToken(
        uint256[] calldata requestIds
    ) external checkNotPause(_REDEEM_SELECTOR) onlyTokenVault {
        // Fulfill the redeem request for the native token.
        // slither-disable-next-line unused-return
        ISupplyManagerV2WithNative(SUPPLY_MANAGER).fulfillRedeemRequestsForNativeToken(requestIds);
    }

    /// @inheritdoc IDepositManagerPool
    function fulfillRedeemRequests(
        uint256[] calldata requestIds,
        address delegator
    ) external checkNotPause(_REDEEM_SELECTOR) {
        // Complete the queued withdrawals.
        IDelegator(delegator).completeQueuedWithdrawals(requestIds);

        // Receive the corresponding ERC20 token and total assets redeemed.
        // slither-disable-next-line reentrancy-benign,unused-return
        ISupplyManagerV2(SUPPLY_MANAGER).fulfillRedeemRequests(address(this), requestIds);
    }

    /// @inheritdoc IDepositManagerPool
    function fulfillRedeemRequestsNative(
        uint256[] calldata requestIds,
        address delegator
    ) external checkNotPause(_REDEEM_SELECTOR) {
        // Complete the queued withdrawals.
        IDelegator(delegator).completeQueuedWithdrawals(requestIds);

        // Receive the corresponding native token and total value redeemed.
        // slither-disable-next-line reentrancy-benign,unused-return
        ISupplyManagerV2WithNative(SUPPLY_MANAGER).fulfillRedeemRequestsForNativeToken(requestIds);
    }

    /// @inheritdoc IMoleculaPoolV2WithNativeToken
    function grantNativeToken(
        address receiver,
        uint256 nativeTokenAmount
    ) external virtual override only(SUPPLY_MANAGER) {
        payable(receiver).sendValue(nativeTokenAmount);
    }

    // ============ VIEW FUNCTIONS ============

    /// @inheritdoc IDepositManagerPool
    function getWithdrawalCredentials(address delegator) external view returns (bytes memory) {
        return
            abi.encodePacked(
                bytes1(0x01),
                bytes11(0),
                DELEGATION_MANAGER.eigenPodManager().getPod(delegator)
            );
    }

    /// @inheritdoc IDepositManagerPool
    function chooseDelegatorForDeposit()
        public
        view
        checkNotPause(_STAKE_SELECTOR)
        returns (address)
    {
        // Get the total restaked TVL and individual operator TVLs.
        (uint256 restakedTvl, uint256[] memory operatorDelegatorTVLs) = totalRestakedSupply();

        // Return the Delegator for deposit.
        return
            IDepositManagerLib(config.depositManagerLib).chooseDelegatorForDeposit(
                restakedTvl,
                operatorDelegatorTVLs,
                address(this)
            );
    }

    /// @inheritdoc IDepositManagerPool
    function chooseDelegatorForWithdrawal()
        public
        view
        checkNotPause(_STAKE_SELECTOR)
        returns (address)
    {
        // Get the total restaked TVL and individual operator TVLs.
        (uint256 restakedTvl, uint256[] memory operatorDelegatorTVLs) = totalRestakedSupply();

        // Return the Delegator for withdrawal.
        return
            IDepositManagerLib(config.depositManagerLib).chooseDelegatorForWithdrawal(
                restakedTvl,
                operatorDelegatorTVLs,
                address(this)
            );
    }

    /// @inheritdoc IDepositManagerPool
    function totalSupply() public view virtual returns (uint256) {
        return IDepositManagerLib(config.depositManagerLib).totalSupply(address(this));
    }

    /// @inheritdoc IDepositManagerPool
    function totalBufferedSupply()
        public
        view
        returns (uint256 bufferedTvl, uint256[] memory bufferedTvls)
    {
        (bufferedTvl, bufferedTvls) = IDepositManagerLib(config.depositManagerLib)
            .getTotalBufferedSupply(address(this));
    }

    /// @inheritdoc IDepositManagerPool
    function totalRestakedSupply()
        public
        view
        virtual
        returns (uint256 restakedTvl, uint256[] memory operatorDelegatorTVLs)
    {
        (restakedTvl, operatorDelegatorTVLs) = IDepositManagerLib(config.depositManagerLib)
            .getTotalRestakedSupply(address(this));
    }

    /// @inheritdoc IDepositManagerPool
    function getPoolsArray() external view returns (address[] memory) {
        return _poolsArray;
    }

    /// @inheritdoc IDepositManagerPool
    function getOperatorsArray() external view returns (address[] memory) {
        return _operatorsArray;
    }

    /// @inheritdoc IDepositManagerPool
    function getStrategy(address token) public view returns (IStrategy) {
        return
            IStrategy(
                IDepositManagerLib(config.depositManagerLib).getStrategy(token, address(this))
            );
    }

    /// @inheritdoc IDepositManagerPool
    function getTokenSupply(address token) public view returns (uint256 tokenSupply) {
        // Get the buffered supply if the token is WETH.
        if (token == WETH) {
            (tokenSupply, ) = totalBufferedSupply();
            return tokenSupply;
        }

        // Get the length of operators.
        uint256 length = _operatorsArray.length;

        // Get the native supply if the token is a native one.
        if (token == ConstantsCoreV2.NATIVE_TOKEN) {
            for (uint256 i = 0; i < length; ++i) {
                tokenSupply += IDelegator(operatorsDelegators[_operatorsArray[i]].delegator)
                    .getDelegatorNativeSupply();
            }
            return tokenSupply;
        }

        // Get the strategy for the token.
        IStrategy strategy = getStrategy(token);

        // Get the token supply for all operators.
        for (uint256 i = 0; i < length; ++i) {
            tokenSupply += IDelegator(operatorsDelegators[_operatorsArray[i]].delegator)
                .getDelegatorTokenSupply(strategy);
        }
    }

    /// @inheritdoc IDepositManagerPool
    function convertTokenToETH(IStrategy strategy, uint256 value) public view returns (uint256) {
        IStrategyLib strategyLib = strategies[address(strategy)].strategyLib;

        return address(strategyLib) != address(0) ? strategyLib.getEthBalance(value) : value;
    }

    /// @inheritdoc IMoleculaPoolV2
    function validatedTotalSupply() public view virtual override returns (uint256 totalPool) {
        // No need to decrease the queued shares to withdraw from EigenLayer as EigenLayer already does that.
        totalPool = totalSupply();
    }

    /**
     * @dev Validates that a token Vault is properly configured for the system.
     * @param tokenVault Token Vault's address to validate.
     */
    function _validateTokenVault(address tokenVault) internal view {
        address token = IERC7575(tokenVault).asset();

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
     * @dev Validates that a token Vault can be removed from the system.
     * @param tokenVault Token Vault's address to validate.
     */
    function _validateTokenToRemove(address tokenVault) internal {
        // Get the token supply for the token.
        address token = IERC7575(tokenVault).asset();
        uint256 tokenSupply = getTokenSupply(token);

        // Could not remove the token Vault if there is any supply of the token staked into EigenLayer.
        if (tokenSupply > 0) {
            // Get the buffered supply if the token is WETH.
            if (token == WETH) {
                // Get the total buffered supply.
                (uint256 bufferedTvl, uint256[] memory bufferedTvls) = totalBufferedSupply();

                // Withdraw the assets from the Pools.
                _withdrawFromPools(tokenSupply, bufferedTvl, bufferedTvls);

                // Get the Molecula Token's address.
                address moleculaToken = ISupplyManagerV2(SUPPLY_MANAGER).moleculaToken();

                // Get the owner of the Molecula Token.
                address owner = Ownable(moleculaToken).owner();

                // Transfer the token supply to the mrETH owner.
                IERC20(WETH).safeTransfer(owner, tokenSupply);
            } else {
                // TODO: Rewrite with metaETH implementation.
                revert ERestakedBalanceNotZero();
            }
        }
    }

    // ============ SETTERS FUNCTIONS ============

    /// @inheritdoc IDepositManagerPool
    function setPools(
        SetPoolData[] calldata setPoolData,
        uint256 expectedPoolLength
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        // Set the new `poolData` and get the balance of ETH to rebalance.
        (PoolData[] memory filteredPoolsData, uint256 balanceEthToRebalance) = _setPools(
            setPoolData,
            expectedPoolLength
        );

        // Rebalance the buffer with the new `poolData` and the ETH balance.
        _rebalanceBuffer(filteredPoolsData, balanceEthToRebalance);
    }

    /**
     * @dev Sets the configuration for a single Pool.
     * @param setPoolData `SetPoolData` struct.
     * @return balanceEthToRebalance Amount of ETH to rebalance.
     */
    function _setPool(
        SetPoolData memory setPoolData
    ) internal returns (uint256 balanceEthToRebalance) {
        if (setPoolData.auth) {
            // Add the Pool if it is not already added.
            if (poolData[setPoolData.pool].poolPortion == 0) {
                _poolsArray.push(setPoolData.pool);

                // Approve WETH to the Pool.
                IERC20(WETH).forceApprove(setPoolData.pool, type(uint256).max);
            }

            // Set the new `poolData`.
            poolData[setPoolData.pool] = setPoolData.newPoolData;
        } else {
            // Remove the Pool from the array of pools.
            PoolData memory _poolData = poolData[setPoolData.pool];
            _poolsArray[_poolData.poolId] = _poolsArray[_poolsArray.length - 1];

            // Revoke the WETH approval from the Pool.
            IERC20(WETH).forceApprove(setPoolData.pool, 0);

            // Remove the duplicated pool from the pools array.
            _poolsArray.pop();

            // Get the Pool's balance.
            balanceEthToRebalance = IBufferInteractor(_poolData.poolLib).getEthBalance(
                setPoolData.pool,
                _poolData.poolToken,
                address(this)
            );

            // Withdraws the deleted Pool's balance.
            if (balanceEthToRebalance > 0) {
                _executeWithdraw(WETH, setPoolData.pool, _poolData.poolLib, balanceEthToRebalance);
            }

            // Delete the deleted Pool's data.
            delete poolData[setPoolData.pool];
        }
    }

    /**
     * @dev Authorizes new Pools.
     * @param setPoolData Array of `SetPoolData` structs.
     * @param expectedPoolLength Expected length of `_poolsArray` after adding and removing Pools.
     * @return filteredPoolsData Array of Pools' data after filtering by the auth's `true` value.
     * @return balanceEthToRebalance Total amount of ETH withdrawn from the LPs.
     */
    function _setPools(
        SetPoolData[] memory setPoolData,
        uint256 expectedPoolLength
    ) internal returns (PoolData[] memory filteredPoolsData, uint256 balanceEthToRebalance) {
        // Get the length of the setPoolData.
        uint256 length = setPoolData.length;

        // `ExpectedPoolLength` could not be greater than the length of `setPoolData`, given the removed Pools.
        if (expectedPoolLength > length) {
            revert EIncorrectLength();
        }

        // Create a new `PoolData` array.
        filteredPoolsData = new PoolData[](expectedPoolLength);

        // Initialize the sum of portions.
        uint256 portionsSum = 0;
        uint256 j = 0;

        // Set the new `poolData` and get the balance of ETH to rebalance for each Pool.
        for (uint256 i = 0; i < length; ++i) {
            SetPoolData memory _setPoolData = setPoolData[i];

            // Set the new `poolData` and get the balance of ETH to rebalance.
            balanceEthToRebalance += _setPool(_setPoolData);

            // If the pool is added, add it to `filteredPoolsData`.
            if (_setPoolData.auth) {
                filteredPoolsData[j] = _setPoolData.newPoolData;
                portionsSum += _setPoolData.newPoolData.poolPortion;

                // Check whether `poolId` is correct.
                if (_setPoolData.pool != _poolsArray[_setPoolData.newPoolData.poolId]) {
                    revert EWrongPoolId();
                }
                unchecked {
                    ++j;
                }
            }
        }

        // `portionsSum` must be equal to 100%.
        if (portionsSum != ConstantsCoreV2.PERCENTAGE_FACTOR) {
            revert EWrongPortion();
        }

        // Check if the `_poolsArray` length is equal to `expectedPoolLength`.
        if (_poolsArray.length != expectedPoolLength) {
            revert EIncorrectExpectedPoolLength();
        }

        emit PoolsSet(setPoolData);
    }

    /// @inheritdoc IMoleculaPoolV2
    function addTokenVault(address tokenVault) external view only(SUPPLY_MANAGER) {
        _validateTokenVault(tokenVault);
    }

    /// @inheritdoc IMoleculaPoolV2
    function removeTokenVault(address tokenVault) external only(SUPPLY_MANAGER) {
        _validateTokenToRemove(tokenVault);
    }

    /// @inheritdoc IDepositManagerPool
    function setBufferPercentage(
        uint16 newBufferPercentage
    ) external checkBPS(newBufferPercentage) onlyRole(DEFAULT_ADMIN_ROLE) {
        config.bufferPercentage = newBufferPercentage;

        emit BufferPercentageChanged(newBufferPercentage);
    }

    /// @inheritdoc IDepositManagerPool
    function setMinFeePercentage(
        uint16 newMinFeePercentage
    ) external checkBPS(newMinFeePercentage) onlyRole(DEFAULT_ADMIN_ROLE) {
        config.minFeePercentage = newMinFeePercentage;

        emit MinFeePercentageChanged(newMinFeePercentage);
    }

    /// @inheritdoc IDepositManagerPool
    function setMaxFeePercentage(
        uint16 newMaxFeePercentage
    ) external checkBPS(newMaxFeePercentage) onlyRole(DEFAULT_ADMIN_ROLE) {
        config.maxFeePercentage = newMaxFeePercentage;

        emit MaxFeePercentageChanged(newMaxFeePercentage);
    }

    /// @inheritdoc IDepositManagerPool
    function setMoleculaBuffer(address newMoleculaBuffer) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setMoleculaBuffer(newMoleculaBuffer);

        emit MoleculaBufferChanged(newMoleculaBuffer);
    }

    /**
     * @dev Sets the Molecula Buffer contract's address.
     * @param newMoleculaBuffer New Molecula Buffer contract's address.
     */
    function _setMoleculaBuffer(
        address newMoleculaBuffer
    ) internal notZeroAddress(newMoleculaBuffer) {
        // If the new Molecula Buffer has a balance, revoke the approval from the old Molecula Buffer.
        if (config.moleculaBuffer != address(0)) {
            // Get the Molecula buffer instance.
            IBufferInteractor oldMoleculaBuffer = IBufferInteractor(config.moleculaBuffer);

            // Get Deposit Manager Pool's balance in the old Molecula Buffer.
            uint256 oldMoleculaBufferBalance = oldMoleculaBuffer.getEthBalance(
                address(0),
                address(0),
                config.moleculaBuffer
            );

            // If the old Molecula Buffer has a balance, withdraw it.
            if (oldMoleculaBufferBalance != 0) {
                // Withdraw the balance from the old Molecula Buffer.
                _executeWithdraw(
                    WETH,
                    config.moleculaBuffer,
                    config.moleculaBuffer,
                    oldMoleculaBufferBalance
                );

                // Deposit the balance into the new Molecula Buffer.
                _executeDeposit(
                    WETH,
                    newMoleculaBuffer,
                    newMoleculaBuffer,
                    oldMoleculaBufferBalance
                );
            }

            // Revoke the WETH approval from the Molecula Buffer.
            IERC20(WETH).forceApprove(config.moleculaBuffer, 0);
        }

        // Set the new Molecula Buffer.
        config.moleculaBuffer = newMoleculaBuffer;

        // Approve WETH to the Molecula Buffer.
        IERC20(WETH).forceApprove(config.moleculaBuffer, type(uint256).max);

        emit MoleculaBufferChanged(newMoleculaBuffer);
    }

    /// @inheritdoc IDepositManagerPool
    function setDelegatorImplementation(
        address newDelegatorImplementation
    ) external onlyRole(DEFAULT_ADMIN_ROLE) notZeroAddress(newDelegatorImplementation) {
        config.delegatorImplementation = newDelegatorImplementation;

        emit DelegatorImplementationChanged(newDelegatorImplementation);
    }

    /// @inheritdoc IDepositManagerPool
    function setDepositManagerLib(
        address newDepositManagerLib
    ) external onlyRole(DEFAULT_ADMIN_ROLE) notZeroAddress(newDepositManagerLib) {
        config.depositManagerLib = IDepositManagerLib(newDepositManagerLib);

        emit DepositManagerLibChanged(newDepositManagerLib);
    }

    // ============ BUFFER DEPOSIT, WITHDRAW AND RESTAKE FUNCTIONS ============

    /// @inheritdoc IDepositManagerPool
    function rebalanceBuffer(
        PoolData[] calldata newPoolsData
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _rebalanceBuffer(newPoolsData, 0);
    }

    /**
     * @dev Rebalances the buffer with new Pool configurations and an extra value.
     * @param newPoolsData Array of new Pool configurations.
     * @param extraValue Additional value to consider in rebalancing.
     */
    function _rebalanceBuffer(PoolData[] memory newPoolsData, uint256 extraValue) internal {
        // Length of the new `_poolsArray`.
        uint256 length = _poolsArray.length;

        // Calculate the buffer TVL.
        uint256 bufferTvl = extraValue + totalSupply();

        // Create arrays for the rebalance calculation.
        uint256[] memory expectedPoolsBalances = new uint256[](length);
        uint256[] memory actualPoolsBalances = new uint256[](length);

        for (uint256 i = 0; i < length; ++i) {
            address pool = _poolsArray[i];

            // Rewrite the new `poolData`.
            poolData[pool] = newPoolsData[i];

            unchecked {
                // Calculate the amount to deposit to the Pool by distribution of deposit portions.
                expectedPoolsBalances[i] =
                    (bufferTvl * newPoolsData[i].poolPortion) /
                    ConstantsCoreV2.PERCENTAGE_FACTOR;
            }

            // Get the actual balance of the Pool.
            actualPoolsBalances[i] = IBufferInteractor(newPoolsData[i].poolLib).getEthBalance(
                pool,
                newPoolsData[i].poolToken,
                address(this)
            );

            // Withdraw extra balance of the Pool.
            if (actualPoolsBalances[i] > expectedPoolsBalances[i]) {
                _executeWithdraw(
                    WETH,
                    pool,
                    newPoolsData[i].poolLib,
                    actualPoolsBalances[i] - expectedPoolsBalances[i]
                );
            }
        }

        // Deposit into Pools after withdrawing all extra balances.
        for (uint256 i = 0; i < length; ++i) {
            if (expectedPoolsBalances[i] > actualPoolsBalances[i]) {
                _executeDeposit(
                    WETH,
                    _poolsArray[i],
                    poolData[_poolsArray[i]].poolLib,
                    expectedPoolsBalances[i] - actualPoolsBalances[i]
                );
            }
        }

        emit BufferRebalanced(newPoolsData, extraValue);
    }

    /**
     * @dev Deposits funds into Pools according to their portions.
     * @param value Total amount to deposit.
     */
    function _depositIntoPools(uint256 value) internal {
        uint256 length = _poolsArray.length;

        // Get the available amounts to deposit for each Pool.
        // slither-disable-next-line unused-return
        (uint256[] memory availableAmounts, ) = IDepositManagerLib(config.depositManagerLib)
            .getAvailableAmountToDeposit(address(this));

        // Calculate the deposit amounts for each Pool.
        (uint256[] memory depositAmounts, uint256 remainingValue) = IDepositManagerLib(
            config.depositManagerLib
        ).calculateDepositAmounts(value, availableAmounts, address(this));

        // Execute deposits based on the calculated amounts.
        for (uint256 i = 0; i < length; ++i) {
            if (depositAmounts[i] > 0) {
                address pool = _poolsArray[i];
                _executeDeposit(WETH, pool, poolData[pool].poolLib, depositAmounts[i]);
            }
        }

        // Deposit remaining value into Molecula Buffer.
        if (remainingValue > 0) {
            _executeDeposit(WETH, config.moleculaBuffer, config.moleculaBuffer, remainingValue);
        }
    }

    /**
     * @dev Withdraws funds from the Pools according to their portions.
     * @param value Total amount to withdraw.
     * @param bufferedTvl Total ETH supply in the Buffer.
     * @notice `bufferedTVL` must be greater than or equal to `value`.
     * @param bufferedTvls Array of ETH supply in each Pool.
     */
    function _withdrawFromPools(
        uint256 value,
        uint256 bufferedTvl,
        uint256[] memory bufferedTvls
    ) internal {
        uint256 length = _poolsArray.length;

        // Track the remaining value to withdraw.
        uint256 remainingValue = value;

        // First, withdraw from `MoleculaBuffer` if it has funds.
        uint256 moleculaBufferBalance = IBufferInteractor(config.moleculaBuffer).getEthBalance(
            config.moleculaBuffer,
            WETH,
            address(this)
        );

        // If `MoleculaBuffer` has funds, withdraw them.
        if (moleculaBufferBalance > 0) {
            unchecked {
                uint256 withdrawAmountFromBuffer = remainingValue < moleculaBufferBalance
                    ? remainingValue
                    : moleculaBufferBalance;
                if (withdrawAmountFromBuffer > 0) {
                    _executeWithdraw(
                        WETH,
                        config.moleculaBuffer,
                        config.moleculaBuffer,
                        withdrawAmountFromBuffer
                    );
                    remainingValue -= withdrawAmountFromBuffer;
                }
            }
        }

        // If the remaining value to withdraw is 0, return the function.
        // slither-disable-next-line incorrect-equality
        if (remainingValue == 0) {
            return;
        }

        // If only one Pool exists, withdraw all the remaining value without calculation.
        if (length == 1) {
            return
                _executeWithdraw(
                    WETH,
                    _poolsArray[0],
                    poolData[_poolsArray[0]].poolLib,
                    remainingValue
                );
        }

        // If we still need to withdraw more, withdraw from Pools to align closer to the target proportions.
        // Use the library to calculate withdrawal amounts.
        (uint256[] memory withdrawalAmounts, uint256 remainingValueAfterCalc) = IDepositManagerLib(
            config.depositManagerLib
        ).calculateWithdrawalAmounts(remainingValue, bufferedTvl, bufferedTvls, address(this));

        // Execute withdrawals based on the calculated amounts.
        for (uint256 i = 0; i < length; ++i) {
            if (withdrawalAmounts[i] > 0) {
                _executeWithdraw(
                    WETH,
                    _poolsArray[i],
                    poolData[_poolsArray[i]].poolLib,
                    withdrawalAmounts[i]
                );
            }
        }

        remainingValue = remainingValueAfterCalc;
    }

    /**
     * @dev Restakes tokens into the configured Pools.
     * @param token Token to restake.
     * @param value Token amount to restake.
     */
    function _restakeTokens(address token, uint256 value) internal {
        if (token == WETH) {
            // Deposit WETH into the configured Pools.
            _depositIntoPools(value);
        } else if (address(getStrategy(token)) != address(0)) {
            // For non-WETH tokens, delegate to an operator.
            address delegator = chooseDelegatorForDeposit();
            IERC20(token).forceApprove(delegator, value);

            // Delegate deposited LRT tokens for the chosen operator.
            IDelegator(delegator).stakeToken(getStrategy(token), IERC20(token), value);
        }
    }

    /// @dev Fallback pattern to use Deposit Manage Restaker without increasing the code size.
    // solhint-disable-next-line no-complex-fallback
    fallback(
        bytes calldata data
    )
        external
        onlyRole(AUTHORIZED_STAKER_ROLE)
        checkNotPause(_STAKE_SELECTOR)
        returns (bytes memory returndata)
    {
        // slither-disable-next-line unused-return
        returndata = DEPOSIT_MANAGER_RESTAKER.functionDelegateCall(data);
    }
}
