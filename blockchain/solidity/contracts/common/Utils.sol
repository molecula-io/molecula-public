// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.23;

import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

/// @dev Check whether the token has the `convertToAssets` function.
/// @param token Token address.
/// @return has Boolean indicating whether the token has the `convertToAssets` function.
function _hasConvertToAssets(address token) view returns (bool) {
    // slither-disable-next-line low-level-calls
    (bool success, bytes memory data) = token.staticcall(
        abi.encodeWithSelector(IERC4626.convertToAssets.selector, uint256(1))
    );
    return success && data.length == 32;
}

/// @dev Gets the decimals of an asset token, defaulting to `18` if the query fails.
/// @param asset Address of the asset token to query.
/// @return assetDecimals Number of decimals of the asset or `18` if the query failed.
function _getDecimalsOr18(address asset) view returns (uint8 assetDecimals) {
    (bool success, bytes memory encodedDecimals) = address(asset).staticcall(
        abi.encodeCall(IERC20Metadata.decimals, ())
    );
    if (success && encodedDecimals.length >= 32) {
        uint256 returnedDecimals = abi.decode(encodedDecimals, (uint256));
        if (returnedDecimals <= type(uint8).max) {
            return uint8(returnedDecimals);
        }
    }
    return 18;
}

/// @dev Normalizes a value from one decimal precision to another.
/// @param value Value to normalize.
/// @param actualDecimals Current decimal precision of the value.
/// @param targetDecimals Desired decimal precision to convert to.
/// @return result Normalized value with the target decimal precision.
/// @notice If `actualDecimals > targetDecimals`, the value is divided to reduce precision.
///         If `actualDecimals < targetDecimals`, the value is multiplied to increase precision.
///         If `actualDecimals == targetDecimals`, the value remains unchanged.
function _normalize(
    uint256 value,
    uint256 actualDecimals,
    uint256 targetDecimals
) pure returns (uint256 result) {
    if (actualDecimals > targetDecimals) {
        value /= uint256(10) ** (actualDecimals - targetDecimals);
    } else if (actualDecimals < targetDecimals) {
        value *= uint256(10) ** (targetDecimals - actualDecimals);
    }
    result = value;
}
