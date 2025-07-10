// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.28;

import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";

/// @dev Owner that does not accept native token
contract MockOwner {
    using Address for address;

    function acceptOwnership(address target) external {
        Ownable2Step(target).acceptOwnership();
    }

    function execute(
        address target,
        bytes calldata data,
        uint256 value
    ) external returns (bytes memory) {
        return target.functionCallWithValue(data, value);
    }
}
