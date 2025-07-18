// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.28;

/// @title Buffer Interactor Interface
/// @notice Defines the functions required for interacting with liquidity pools.
interface IBufferInteractor {
    /**
     * @dev Encodes the data for depositing into the Pool.
     * @param asset Deposit token's address.
     * @param receiver Address of the LP token receiver.
     * @param amount Amount to deposit.
     * @return bytes Encoded message for the deposit transaction.
     */
    function encodeSupply(
        address asset,
        address receiver,
        uint256 amount
    ) external pure returns (bytes memory);

    /**
     * @dev Encodes data for withdrawing from a Pool.
     * @param asset Deposit token's address.
     * @param receiver Address of the LP token receiver.
     * @param amount Amount to withdraw.
     * @return bytes Encoded message for the withdrawal transaction.
     */
    function encodeWithdraw(
        address asset,
        address receiver,
        uint256 amount
    ) external pure returns (bytes memory);

    /**
     * @dev Gets the withdrawable ETH balance.
     * @param pool Address of the protocol's balance storage.
     * @param asset Deposit token's address.
     * @param owner LP token owner's address.
     * @return uint256 Withdrawable ETH balance.
     */
    function getEthBalance(
        address pool,
        address asset,
        address owner
    ) external view returns (uint256);

    /**
     * @dev Gets the available amount to deposit into a Pool.
     * @param pool Address of the protocol's balance storage.
     * @param token Deposit token's address.
     * @param poolToken Pool token's address.
     * @return uint256 Available amount to deposit.
     */
    function getAvailableAmountToDeposit(
        address pool,
        address token,
        address poolToken
    ) external view returns (uint256);
}
