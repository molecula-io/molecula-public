// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.24;

/**
 * Link to the original contract:
 * https://github.com/smartcontractkit/chainlink-evm/blob/develop/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol
 */

// solhint-disable-next-line interface-starts-with-i
interface AggregatorV3Interface {
    function decimals() external view returns (uint8);

    function description() external view returns (string memory);

    function version() external view returns (uint256);

    function getRoundData(
        uint80 _roundId
    )
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        );

    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        );
}
