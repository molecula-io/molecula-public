/**
 * Link to the original contract:
 * https://etherscan.io/address/0x947f0054faed3481ff4e76ca35f12fbe36cc665b#code#F38#L1
 */

// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {WadRayMath} from "./WadRayMath.sol";

/**
 * @title MathUtils library.
 * @author AAVE
 * @notice Provides functions to perform linear and compounded interest calculations.
 */
library MathUtils {
    using WadRayMath for uint256;

    /// @dev Ignoring leap years.
    uint256 internal constant SECONDS_PER_YEAR = 365 days;

    /**
     * @dev Function to calculate the interest accumulated using the linear interest rate formula.
     * @param rate Interest rate, in ray.
     * @param lastUpdateTimestamp Timestamp of the interest's last update.
     * @return interestRateAccumulated Interest rate linearly accumulated during `timeDelta`, in ray.
     */
    function calculateLinearInterest(
        uint256 rate,
        uint40 lastUpdateTimestamp
    ) internal view returns (uint256) {
        //solium-disable-next-line
        uint256 result = rate * (block.timestamp - uint256(lastUpdateTimestamp));
        unchecked {
            result = result / SECONDS_PER_YEAR;
        }

        return WadRayMath.RAY + result;
    }

    /**
     * @dev Function to calculate the interest using the compounded interest rate formula.
     * To avoid expensive exponentiation, the calculation is performed using the binomial approximation:
     *
     *  `(1+x)^n = 1+n*x+[n/2*(n-1)]*x^2+[n/6*(n-1)*(n-2)*x^3...`
     *
     * The approximation slightly underpays liquidity providers and undercharges borrowers, with
     * the advantage of great gas cost reductions. The whitepaper contains reference to
     * the approximation and a table showing the margin of error per different time periods.
     *
     * @param rate Interest rate, in ray.
     * @param lastUpdateTimestamp Timestamp of the interest's last update.
     * @return interestRateCompounded Interest rate compounded during `timeDelta`, in ray.
     */
    function calculateCompoundedInterest(
        uint256 rate,
        uint40 lastUpdateTimestamp,
        uint256 currentTimestamp
    ) internal pure returns (uint256) {
        //solium-disable-next-line
        uint256 exp = currentTimestamp - uint256(lastUpdateTimestamp);

        if (exp == 0) {
            return WadRayMath.RAY;
        }

        // Calculation of the compound interest using the `e^(rate per year * number of years)` ideal formula:
        // `100_000% per year = 1_000 * 100, passed 10_000 years`:
        // `e^(1_000 * 10_000) = 6.5922325346184394895608861310659088446667722661221381641234330770... × 10^4342944`
        // The current formula in the contract returns:
        // `1.66666716666676666667 × 10^20`
        // This happens because the contract uses a polynomial approximation of the ideal formula
        // and on large numbers the ideal formula with exponential function has much more speed.
        // The approximation used in contracts is not precise enough for such large numbers.
        //
        // However, we can be sure that the current formula in contracts can't overflow on such large numbers
        // and we can use unchecked arithmetic to save gas.
        //
        // Also, if we take into account the fact that all timestamps are stored in uint32/40 types,
        // we only have about 100 years left before overflows in timestamps occur.
        // Given that, realistically, we can't overflow in this formula.

        unchecked {
            // This can't overflow as the rate is always fits in 128 bits and exp always fits in 40 bits.
            uint256 x = (rate * exp) / SECONDS_PER_YEAR;

            return WadRayMath.RAY + x + x.rayMul(x / 2 + x.rayMul(x / 6));
        }
    }

    /**
     * @dev Calculates the compounded interest between the timestamp of the last update and the current block timestamp.
     * @param rate Interest rate, in ray.
     * @param lastUpdateTimestamp Timestamp from which the interest accumulation needs to be calculated.
     * @return Interest rate compounded between `lastUpdateTimestamp` and current block timestamp, in ray.
     */
    function calculateCompoundedInterest(
        uint256 rate,
        uint40 lastUpdateTimestamp
    ) internal view returns (uint256) {
        return calculateCompoundedInterest(rate, lastUpdateTimestamp, block.timestamp);
    }
}
