// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

interface IERC20Provider {
    /**
     * @dev Returns the ERC20 token address.
     * @return token ERC20 token address.
     */
    function getERC20Token() external view returns (address token);
}
