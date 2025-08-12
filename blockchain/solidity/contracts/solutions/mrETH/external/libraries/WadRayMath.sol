/**
 * Link to the original contract:
 * https://etherscan.io/address/0x947f0054faed3481ff4e76ca35f12fbe36cc665b#code#F33#L59
 */

// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

/**
 * @title WadRayMath library
 * @author AAVE
 * @notice Provides functions to perform calculation with Wad and Ray units.
 * @dev Provides the `mul` and `div` functions for:
 * - wads, decimal numbers with 18 digits of precision.
 * - rays, decimal numbers with 27 digits of precision.
 * @dev Operations are rounded. If a value is `>=.5`, it will be rounded up. Otherwise, it will be rounded down.
 */
library WadRayMath {
    // `HALF_WAD` and `HALF_RAY` expressed with extended notation as constant with operations are not supported in the Yul assembly.
    uint256 internal constant WAD = 1e18;
    uint256 internal constant HALF_WAD = 0.5e18;

    uint256 internal constant RAY = 1e27;
    uint256 internal constant HALF_RAY = 0.5e27;

    uint256 internal constant WAD_RAY_RATIO = 1e9;

    /**
     * @dev Multiplies two wad, rounding half up to the nearest wad.
     * @dev Assembly optimized for improved gas savings. See: https://twitter.com/transmissions11/status/1451131036377571328.
     * @param a Wad.
     * @param b Wad.
     * @return c `c = a*b`, in wad.
     */
    function wadMul(uint256 a, uint256 b) internal pure returns (uint256 c) {
        // To avoid overflow, `a` must be `<= (type(uint256).max - HALF_WAD) / b`.
        assembly {
            if iszero(or(iszero(b), iszero(gt(a, div(sub(not(0), HALF_WAD), b))))) {
                revert(0, 0)
            }

            c := div(add(mul(a, b), HALF_WAD), WAD)
        }
    }

    /**
     * @dev Divides two wad, rounding half up to the nearest wad.
     * @dev Assembly optimized for improved gas savings. See: https://twitter.com/transmissions11/status/1451131036377571328.
     * @param a Wad.
     * @param b Wad.
     * @return c `c = a/b`, in wad.
     */
    function wadDiv(uint256 a, uint256 b) internal pure returns (uint256 c) {
        // To avoid overflow, `a` must be `<= (type(uint256).max - halfB) / WAD`.
        assembly {
            if or(iszero(b), iszero(iszero(gt(a, div(sub(not(0), div(b, 2)), WAD))))) {
                revert(0, 0)
            }

            c := div(add(mul(a, WAD), div(b, 2)), b)
        }
    }

    /**
     * @notice Multiplies two ray, rounding half up to the nearest ray.
     * @dev Assembly optimized for improved gas savings. See: https://twitter.com/transmissions11/status/1451131036377571328.
     * @param a Ray.
     * @param b Ray.
     * @return c `c = a`, raymul b.
     */
    function rayMul(uint256 a, uint256 b) internal pure returns (uint256 c) {
        // To avoid overflow, `a` must be `<= (type(uint256).max - HALF_RAY) / b`.
        assembly {
            if iszero(or(iszero(b), iszero(gt(a, div(sub(not(0), HALF_RAY), b))))) {
                revert(0, 0)
            }

            c := div(add(mul(a, b), HALF_RAY), RAY)
        }
    }

    /**
     * @notice Divides two ray values, rounding half up to the nearest ray.
     * @dev Assembly optimized for improved gas savings. See: https://twitter.com/transmissions11/status/1451131036377571328.
     * @param a Ray.
     * @param b Ray.
     * @return c `c = a`, raydiv b.
     */
    function rayDiv(uint256 a, uint256 b) internal pure returns (uint256 c) {
        // To avoid overflow, `a` must be `<= (type(uint256).max - halfB) / RAY`.
        assembly {
            if or(iszero(b), iszero(iszero(gt(a, div(sub(not(0), div(b, 2)), RAY))))) {
                revert(0, 0)
            }

            c := div(add(mul(a, RAY), div(b, 2)), b)
        }
    }

    /**
     * @dev Casts ray down to wad.
     * @dev Assembly optimized for improved gas savings. See: https://twitter.com/transmissions11/status/1451131036377571328.
     * @param a Ray.
     * @return b `b = a`, converted to wad and rounded half up to the nearest wad.
     */
    function rayToWad(uint256 a) internal pure returns (uint256 b) {
        assembly {
            b := div(a, WAD_RAY_RATIO)
            let remainder := mod(a, WAD_RAY_RATIO)
            if iszero(lt(remainder, div(WAD_RAY_RATIO, 2))) {
                b := add(b, 1)
            }
        }
    }

    /**
     * @dev Converts wad to ray.
     * @dev Assembly optimized for improved gas savings. See: https://twitter.com/transmissions11/status/1451131036377571328.
     * @param a Wad.
     * @return b `b = a`, converted in ray.
     */
    function wadToRay(uint256 a) internal pure returns (uint256 b) {
        // To avoid overflow, `b/WAD_RAY_RATIO == a` must be `true`.
        assembly {
            b := mul(a, WAD_RAY_RATIO)

            if iszero(eq(div(b, WAD_RAY_RATIO), a)) {
                revert(0, 0)
            }
        }
    }
}
