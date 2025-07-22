// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IAaveV3Pool} from "./../external/interfaces/IAaveV3Pool.sol";

/// @title AAVE Buffer Library
/// @notice Library for interacting with AAVE lending Pools.
library AaveBufferLib {
    /// @dev Constant for the selector of the the AAVE's `deposit` function.
    bytes4 internal constant SUPPLY_SELECTOR =
        // solhint-disable-next-line gas-small-strings
        bytes4(keccak256("supply(address,uint256,address,uint16)"));

    /// @dev Constant for the selector of the AAVE's `withdraw` function.
    bytes4 internal constant WITHDRAW_SELECTOR =
        // solhint-disable-next-line gas-small-strings
        bytes4(keccak256("withdraw(address,uint256,address)"));

    /// @dev Constant for the mask of the supply cap in Aave v3 storage.
    uint256 internal constant SUPPLY_CAP_MASK =
        0x00000000000000000000000000FFFFFFFFF00000000000000000000000000000;

    /// @dev Constant for the start bit position of the supply cap in Aave v3 storage.
    uint256 internal constant SUPPLY_CAP_START_BIT_POSITION = 116;

    /**
     * @dev Encodes the data for depositing into an AAVE Pool.
     * @param token Deposit token's address.
     * @param receiver LP token receiver's address.
     * @param amount Amount to deposit.
     * @return bytes Encoded message for the deposit transaction.
     */
    function encodeSupply(
        address token,
        address receiver,
        uint256 amount
    ) external pure returns (bytes memory) {
        return abi.encodeWithSelector(SUPPLY_SELECTOR, token, amount, receiver, 0);
    }

    /**
     * @dev Encodes data for withdrawing from an AAVE Pool.
     * @param token Deposit token's address.
     * @param receiver Address of the LP token receiver.
     * @param amount Amount to withdraw.
     * @return bytes Encoded message for the withdrawal transaction.
     */
    function encodeWithdraw(
        address token,
        address receiver,
        uint256 amount
    ) external pure returns (bytes memory) {
        return abi.encodeWithSelector(WITHDRAW_SELECTOR, token, amount, receiver);
    }

    /**
     * @dev Gets the withdrawable ETH balance.
     * @param token Deposit token's address.
     * @param owner LP token owner's address.
     * @return uint256 Withdrawable ETH balance.
     */
    function getEthBalance(address, address token, address owner) external view returns (uint256) {
        return IERC20(token).balanceOf(owner);
    }

    /**
     * @dev Gets the available amount to deposit into an AAVE Pool.
     * @param pool Address of the protocol's balance storage.
     * @param token Deposit token's address.
     * @param poolToken AToken's address.
     * @return uint256 Available amount to deposit.
     */
    function getAvailableAmountToDeposit(
        address pool,
        address token,
        address poolToken
    ) external view returns (uint256) {
        // Get actual supply of token in pool.
        uint256 totalSupply = IERC20(poolToken).totalSupply();
        uint256 supplyCap = getCap(pool, token);

        // If supply cap is 0, no limit .
        if (supplyCap == 0) {
            return type(uint256).max;
        }

        // Convert supply cap to token decimals.
        supplyCap = supplyCap * 10 ** IERC20Metadata(token).decimals();
        unchecked {
            return supplyCap > totalSupply ? supplyCap - totalSupply : 0;
        }
    }

    /**
     * @dev  Gets the supply cap of the reserve from storage
     * @param pool The Aave v3pool address
     * @param token The token address
     * @return The state param representing supply cap.
     */
    function getCap(address pool, address token) internal view returns (uint256) {
        uint256 dataLocal = (IAaveV3Pool(pool).getConfiguration(token)).data;

        return (dataLocal & SUPPLY_CAP_MASK) >> SUPPLY_CAP_START_BIT_POSITION;
    }
}
