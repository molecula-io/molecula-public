// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import {OptionsBuilder} from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/libs/OptionsBuilder.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";

contract OptionsLZ is Ownable2Step {
    using OptionsBuilder for bytes;

    /// @dev Base bit flag.
    uint16 private constant _BASE = 0x100;

    /// @dev Unit bit flag.
    uint16 private constant _UNIT = 0x200;

    /// @dev Authorized LayerZero configurator.
    address public authorizedLZConfigurator;

    /// @dev Mapping of `gasLimit`.
    mapping(uint16 => uint256) public gasLimit;

    /// @dev Throws an error if the caller is not the authorized LZ configurator.
    error ENotAuthorizedLZConfigurator();

    /// @dev Modifier to check whether the caller is the authorized LZ configurator.
    modifier onlyAuthorizedLZConfigurator() {
        if (msg.sender != authorizedLZConfigurator) {
            revert ENotAuthorizedLZConfigurator();
        }
        _;
    }

    /**
     * @dev Constructor.
     * @param initialOwner Smart contract owner address.
     * @param authorizedLZConfiguratorAddress Authorized LZ configurator address.
     */
    constructor(
        address initialOwner,
        address authorizedLZConfiguratorAddress
    ) Ownable(initialOwner) {
        authorizedLZConfigurator = authorizedLZConfiguratorAddress;
    }

    /**
     * @dev Sets the gas limit.
     * @param msgType Message type.
     * @param gasLimitBase Gas limit base.
     * @param gasLimitUnit Gas limit unit.
     */
    function setGasLimit(
        uint8 msgType,
        uint256 gasLimitBase,
        uint256 gasLimitUnit
    ) external onlyAuthorizedLZConfigurator {
        gasLimit[_BASE | msgType] = gasLimitBase;
        gasLimit[_UNIT | msgType] = gasLimitUnit;
    }

    /**
     * @dev Get the gas limit.
     * @param msgType Message type.
     * @param count Unit gas limit count.
     * @return lzOptions LayerZero call options.
     */
    function getLzOptions(
        uint8 msgType,
        uint256 count
    ) public view returns (bytes memory lzOptions) {
        uint256 gasLimitTotal = gasLimit[_BASE | msgType] + gasLimit[_UNIT | msgType] * count;
        lzOptions = OptionsBuilder.newOptions().addExecutorLzReceiveOption(
            uint128(gasLimitTotal),
            0
        );
    }

    /**
     * @dev Sets the authorized LZ configurator.
     * @param authorizedLZConfiguratorAddress Authorized LZ configurator address.
     */
    function setAuthorizedLZConfigurator(
        address authorizedLZConfiguratorAddress
    ) external onlyOwner {
        authorizedLZConfigurator = authorizedLZConfiguratorAddress;
    }
}
