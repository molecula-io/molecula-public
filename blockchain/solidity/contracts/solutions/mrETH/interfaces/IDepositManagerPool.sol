// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.30;

import {IMoleculaPoolV2WithNativeToken} from "./../../../coreV2/interfaces/IMoleculaPoolV2.sol";
import {IStrategy} from "./../external/interfaces/IStrategy.sol";
import {IDepositManagerTypes} from "./IDepositManagerTypes.sol";

/// @title IDepositManagerWithImmediateRedeem.
/// @notice Interface for managing the redemption fees in the Molecula Pool.
/// @dev Extends `IMoleculaPoolV2` with the redemption fees functionality.
interface IDepositManagerWithImmediateRedeem is IMoleculaPoolV2WithNativeToken {
    /// @dev Executes a redemption operation request.
    /// @param requestIds Redemption operation's IDs.
    function fulfillRedeemImmediately(uint256[] calldata requestIds) external;

    /// @dev Executes a redemption operation request for the native token.
    /// @param requestIds Redemption operation's IDs.
    function fulfillRedeemImmediatelyForNativeToken(uint256[] calldata requestIds) external;
}

/// @title Deposit Manager Pool Interface.
/// @notice Defines the functions and events required for Pool data management.
interface IDepositManagerPool is IDepositManagerWithImmediateRedeem, IDepositManagerTypes {
    /**
     * @dev Emitted when processing deposits.
     * @param token Deposit token's address.
     * @param vault Token Vault's address.
     * @param value Deposited amount.
     */
    event Deposit(address indexed token, address indexed vault, uint256 indexed value);

    /// @dev Emitted when the Buffer percentage is changed.
    /// @param newBufferPercentage New Buffer percentage value.
    event BufferPercentageChanged(uint16 indexed newBufferPercentage);

    /// @dev Emitted when the Molecula Buffer address is changed.
    /// @param newMoleculaBuffer New Molecula Buffer's address.
    event MoleculaBufferChanged(address indexed newMoleculaBuffer);

    /// @dev Emitted when the Delegator implementation address is changed.
    /// @param newDelegatorImplementation New Delegator implementation address.
    event DelegatorImplementationChanged(address indexed newDelegatorImplementation);

    /// @dev Emitted when the Deposit Manager library address is changed.
    /// @param newDepositManagerLib New Deposit Manager library address.
    event DepositManagerLibChanged(address indexed newDepositManagerLib);

    /// @dev Emitted when Pools are configured.
    /// @param setPoolData Array of `SetPoolData` structs.
    event PoolsSet(SetPoolData[] indexed setPoolData);

    /// @dev Emitted when a redeem from the Buffer is processed.
    /// @param requestId Request ID.
    /// @param value Redeemed value.
    event RedeemFromBuffer(uint256 indexed requestId, uint256 indexed value);

    /// @dev Emitted when the Buffer is rebalanced.
    /// @param newPoolsData Array of new Pools' data.
    /// @param extraValue Extra value.
    event BufferRebalanced(PoolData[] newPoolsData, uint256 extraValue);

    /// @dev Emitted when the min fee percentage is changed.
    /// @param newMinFeePercentage New minimum fee percentage.
    event MinFeePercentageChanged(uint16 indexed newMinFeePercentage);

    /// @dev Emitted when the max fee percentage is changed.
    /// @param newMaxFeePercentage New maximum fee percentage.
    event MaxFeePercentageChanged(uint16 indexed newMaxFeePercentage);

    /// @dev Error: Incorrect array length.
    error EIncorrectLength();

    /// @dev Error: `poolId` does not match the position in the array.
    error EWrongPoolId();

    /// @dev Error: Expected Pool length is incorrect.
    error EIncorrectExpectedPoolLength();

    /// @dev Error: Indicates that the token has an active restaked balance in EigenLayer.
    error ERestakedBalanceNotZero();

    /// @dev Error: New token Vault does not have a strategy in the `DepositManager` contract.
    error EStrategyNotExists();

    /// @dev Error: Wrong portion.
    error EWrongPortion();

    /// @dev Error: Unsupported token to redeem from the Buffer.
    error EUnsupportedRedeemFromBufferToken();

    /// @dev Error: Token supply is not zero.
    error ETokenSupplyNotZero();

    /**
     * @dev Initialize function.
     * @param delegatorImplementation_ Delegator implementation address.
     * @param moleculaBuffer_ Molecula Buffer contract's address.
     * @param depositManagerLib_ `DepositManagerLib` address for calculations.
     * @param bufferPercent_ Percentage from the TVL to be stored in the Pools.
     * @param setPoolData_ Array of `SetPoolData` structs.
     */
    function initialize(
        address delegatorImplementation_,
        address moleculaBuffer_,
        address depositManagerLib_,
        uint16 bufferPercent_,
        SetPoolData[] calldata setPoolData_
    ) external;

    /**
     * @dev Authorizes new Pools.
     * @param setPoolData Array of `SetPoolData` structs.
     * @param expectedPoolLength Expected length of the `poolsArray` after addition and removal.
     */
    function setPools(SetPoolData[] calldata setPoolData, uint256 expectedPoolLength) external;

    /**
     * @dev Changes `poolPortions` and rebalances the Buffer.
     * @param newPoolsData Array of new Pools' data.
     */
    function rebalanceBuffer(PoolData[] calldata newPoolsData) external;

    /**
     * @dev Setter for `bufferPercentage`.
     * @param newBufferPercentage New `bufferPercentage` number.
     */
    function setBufferPercentage(uint16 newBufferPercentage) external;

    /**
     * @dev Setter for `minFeePercentage`.
     * @param newMinFeePercentage New `minFeePercentage` number.
     */
    function setMinFeePercentage(uint16 newMinFeePercentage) external;

    /**
     * @dev Setter for `maxFeePercentage`.
     * @param newMaxFeePercentage New `maxFeePercentage` number.
     */
    function setMaxFeePercentage(uint16 newMaxFeePercentage) external;

    /**
     * @dev Setter for the Molecula Buffer address.
     * @param newMoleculaBuffer New Molecula Buffer address.
     */
    function setMoleculaBuffer(address newMoleculaBuffer) external;

    /**
     * @dev Setter for the Delegator contract implementation address.
     * @param _delegatorImplementation New delegator contract implementation address.
     */
    function setDelegatorImplementation(address _delegatorImplementation) external;

    /**
     * @dev Setter for the Deposit Manager Library's address.
     * @param newDepositManagerLib New Deposit Manager Library's address.
     */
    function setDepositManagerLib(address newDepositManagerLib) external;

    /**
     * @dev Picks the Delegator with the TVL below the threshold or returns the first one in the list.
     * @return Chosen Delegator's address.
     */
    function chooseDelegatorForDeposit() external view returns (address);

    /**
     * @dev Picks the Delegator with the TVL below the threshold or returns the first one in the list.
     * @return Chosen Delegator's address.
     */
    function chooseDelegatorForWithdrawal() external view returns (address);

    /**
     * @dev Getter for the `WithdrawalCredentials` variable for the provided operator.
     * @param delegator Contract for delegation values.
     * @return withdrawalCredentials Withdrawal credentials' bytes.
     */
    function getWithdrawalCredentials(address delegator) external view returns (bytes memory);

    /**
     * @dev Getter for the total supply.
     * @return totalSupply Total supply.
     */
    function totalSupply() external view returns (uint256);

    /**
     * @dev Calculates the total buffered supply including the yield from LP tokens.
     * @return bufferedTvl Total ETH supply in the Buffer.
     * @return bufferedTvls Array of ETH supply in each Pool.
     */
    function totalBufferedSupply()
        external
        view
        returns (uint256 bufferedTvl, uint256[] memory bufferedTvls);

    /**
     * @dev Calculates the yield on the increased staked balances.
     * @return restakedTvl Total ETH supply in EigenLayer.
     * @return operatorDelegatorTVLs Array of Delegators' ETH supply in EigenLayer.
     */
    function totalRestakedSupply()
        external
        view
        returns (uint256 restakedTvl, uint256[] memory operatorDelegatorTVLs);

    /**
     * @dev Gets an array of all Pools.
     * @return poolsArray Array of Pool addresses.
     */
    function getPoolsArray() external view returns (address[] memory poolsArray);

    /**
     * @dev Gets an array of all operators.
     * @return operatorsArray Array of operator addresses.
     */
    function getOperatorsArray() external view returns (address[] memory operatorsArray);

    /**
     * @dev Gets the strategy for a specific token.
     * @param token Token's address.
     * @return strategy Strategy's contract address.
     */
    function getStrategy(address token) external view returns (IStrategy strategy);

    /**
     * @dev Getter for the token supply.
     * @param token Address of the token.
     * @return tokenSupply Token supply amount.
     */
    function getTokenSupply(address token) external view returns (uint256 tokenSupply);

    /**
     * @dev Converter of the token balance into ETH.
     * @param value Amount of tokens to convert.
     * @param strategy Strategy contract's address.
     * @return convertedValueToETH Amount of ETH converted from the token value.
     */
    function convertTokenToETH(IStrategy strategy, uint256 value) external view returns (uint256);

    /**
     * @dev Fulfills a redeem requests for a specified operator.
     * @param requestIds Array of request IDs to complete.
     * @param delegator Address of the Delegator to complete the withdrawals.
     */
    function fulfillRedeemRequests(uint256[] calldata requestIds, address delegator) external;

    /**
     * @dev Fulfills redeem requests for the specified operator.
     * @param requestIds Array of request IDs to complete.
     * @param delegator Address of the Delegator to complete the withdrawals.
     */
    function fulfillRedeemRequestsNative(uint256[] calldata requestIds, address delegator) external;
}
