// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.30;

import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract MockPriceFeed is AggregatorV3Interface, Ownable {
    int256 public price;
    uint256 public updatedAt;

    constructor(int256 price_, address owner_) Ownable(owner_) {
        price = price_;
        updatedAt = block.timestamp;
    }

    function decimals() external pure returns (uint8) {
        return 8;
    }

    function description() external pure returns (string memory) {
        return "any / any";
    }

    function version() external pure returns (uint256) {
        return 0;
    }

    function getRoundData(
        uint80 /*_roundId*/
    )
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 /*updatedAt*/,
            uint80 answeredInRound
        )
    {
        return (0, price, 0, updatedAt, 0);
    }

    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 /*updatedAt*/,
            uint80 answeredInRound
        )
    {
        return (0, price, 0, updatedAt, 0);
    }

    function setPrice(int256 price_) external onlyOwner {
        price = price_;
        updatedAt = block.timestamp;
    }
}
