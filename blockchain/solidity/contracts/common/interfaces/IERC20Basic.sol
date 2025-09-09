// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.28;

/**
 * @title IERC20Basic.
 * @dev This interface is same as IERC20 but `transfer`, `transferFrom` and `approve` functions don't return anything.
 */
interface IERC20Basic {
    /**
     * @dev Returns the total tokens supply.
     * @return uint256 Total tokens supply.
     */
    function totalSupply() external view returns (uint256);

    /**
     * @dev Returns the user's balance.
     * @param who User whose balance is to be returned.
     * @return uint256 User's balance.
     */
    function balanceOf(address who) external view returns (uint256);

    /**
     * @dev Transfers tokens.
     * @param to Tokens recipient's address.
     * @param value Amount to transfer.
     */
    // slither-disable-next-line erc20-interface
    function transfer(address to, uint256 value) external;

    /**
     * @dev Returns the user's allowance.
     * @param owner User whose allowance is to be returned.
     * @param spender User whose allowance is to be returned.
     * @return uint256 User's allowance.
     */
    function allowance(address owner, address spender) external view returns (uint256);

    /**
     * @dev Transfers tokens from one address to another.
     * @param from Tokens sender's address.
     * @param to Tokens recipient's address.
     * @param value Amount to transfer.
     */
    // slither-disable-next-line erc20-interface
    function transferFrom(address from, address to, uint256 value) external;

    /**
     * @dev Approves a spender.
     * @param spender Spender's address.
     * @param value Amount to approve.
     */
    // slither-disable-next-line erc20-interface
    function approve(address spender, uint256 value) external;
}
