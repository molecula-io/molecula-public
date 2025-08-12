/**
 * Link to the original contract:
 * https://etherscan.io/address/0x947f0054faed3481ff4e76ca35f12fbe36cc665b#code#F39#L1
 */

// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

/**
 * @title PercentageMath library
 * @author AAVE
 * @notice Provides functions to perform percentage calculations.
 * @dev Percentages are defined by default with 2 decimals of precision (100.00). The precision is indicated by `PERCENTAGE_FACTOR`.
 * @dev Operations are rounded. If a value is `>=.5`, it will be rounded up. Otherwise, it will be rounded down.
 */
library PercentageMath {
    // Maximum percentage factor (100.00%).
    uint256 internal constant PERCENTAGE_FACTOR = 1e4;

    // Half percentage factor (50.00%).
    uint256 internal constant HALF_PERCENTAGE_FACTOR = 0.5e4;

    /**
     * @notice Executes a percentage multiplication.
     * @dev Assembly optimized for improved gas savings. See: https://twitter.com/transmissions11/status/1451131036377571328.
     * @param value Value the percentage of which needs to be calculated.
     * @param percentage Percentage of the value to be calculated.
     * @return result Value `percentmul` percentage.
     */
    function percentMul(uint256 value, uint256 percentage) internal pure returns (uint256 result) {
        // To avoid overflow, the value must be `<= (type(uint256).max - HALF_PERCENTAGE_FACTOR) / percentage`.
        assembly {
            if iszero(
                or(
                    iszero(percentage),
                    iszero(gt(value, div(sub(not(0), HALF_PERCENTAGE_FACTOR), percentage)))
                )
            ) {
                revert(0, 0)
            }

            result := div(add(mul(value, percentage), HALF_PERCENTAGE_FACTOR), PERCENTAGE_FACTOR)
        }
    }

    /**
     * @notice Executes percentage division.
     * @dev Assembly optimized for improved gas savings. See: https://twitter.com/transmissions11/status/1451131036377571328.
     * @param value Value the percentage of which needs to be calculated.
     * @param percentage Percentage of the value to be calculated.
     * @return result Value `percentdiv` percentage.
     */
    function percentDiv(uint256 value, uint256 percentage) internal pure returns (uint256 result) {
        // To avoid overflow, the value must be `<= (type(uint256).max - halfPercentage) / PERCENTAGE_FACTOR`.
        assembly {
            if or(
                iszero(percentage),
                iszero(iszero(gt(value, div(sub(not(0), div(percentage, 2)), PERCENTAGE_FACTOR))))
            ) {
                revert(0, 0)
            }

            result := div(add(mul(value, PERCENTAGE_FACTOR), div(percentage, 2)), percentage)
        }
    }
}
