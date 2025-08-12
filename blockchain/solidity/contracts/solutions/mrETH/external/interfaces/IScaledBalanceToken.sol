/**
 * Link to the original contract:
 * https://etherscan.io/address/0x97f5b96c7dac8547251330b63760951a4fab448d#code#F19#L1
 */
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title IScaledBalanceToken
 * @author Aave
 * @notice Defines the basic interface for a scaled-balance token.
 */
interface IScaledBalanceToken {
    /**
     * @dev Emitted after the mint action.
     * @param caller Address performing the mint.
     * @param onBehalfOf Address of the user that will receive the minted tokens.
     * @param value Scaled-up mint amount based on the amount entered by the user and the balance increase from interest.
     * @param balanceIncrease Increase in scaled-up balance since the last `onBehalfOf` action.
     * @param index Next reserve liquidity index.
     */
    event Mint(
        address indexed caller,
        address indexed onBehalfOf,
        uint256 value,
        uint256 balanceIncrease,
        uint256 index
    );

    /**
     * @dev Emitted after the burn action.
     * @dev If the `burn` function does not involve a transfer of the underlying asset, the target defaults to the zero address.
     * @param from Address tokens of which will be burned.
     * @param target Address that will receive the underlying asset, if any.
     * @param value Scaled-up burn amount based on the amount entered by the user and the balance increase from interest.
     * @param balanceIncrease Increase in the scaled-up balance since the last `from` action.
     * @param index Next reserve liquidity index.
     */
    event Burn(
        address indexed from,
        address indexed target,
        uint256 value,
        uint256 balanceIncrease,
        uint256 index
    );

    /**
     * @notice Returns the scaled balance of the user.
     * @dev Scaled balance is the sum of all the updated stored balance divided by the reserve's
     * liquidity index at the moment of the update.
     * @param user User whose balance is calculated.
     * @return User's scaled balance.
     */
    function scaledBalanceOf(address user) external view returns (uint256);

    /**
     * @notice Returns the scaled balance of the user and the scaled total supply.
     * @param user User's address.
     * @return User's scaled balance.
     * @return Scaled total supply.
     */
    function getScaledUserBalanceAndSupply(address user) external view returns (uint256, uint256);

    /**
     * @notice Returns the scaled total supply of the scaled balance token. Represents `sum(debt/index)`.
     * @return Scaled total supply,
     */
    function scaledTotalSupply() external view returns (uint256);

    /**
     * @notice Returns the last index interest accrued to the user's balance.
     * @param user User's address.
     * @return Last index interest accrued to the user's balance, denominated in ray units.
     */
    function getPreviousIndex(address user) external view returns (uint256);
}
