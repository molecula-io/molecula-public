// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.30;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {DataTypes} from "./../../solutions/mrETH/external/libraries/DataTypes.sol";

/// @title Mock Aave v3 Pool contract for tests in Holesky.
/// @notice Mock Aave v3 Pool contract for tests in Holesky.
/// @dev This contract is used to mock the Aave v3 Pool and aToken for WETH contract for tests in Holesky.
contract MockAavePool is ERC20 {
    using SafeERC20 for IERC20;

    // Data from mainnet aave v3 pool. Data type is DataTypes.ReserveConfigurationMap.
    uint256 public constant MOCK_CONFIG_DATA =
        7237005577332262213973186942896404434209959786468055790956074122879766896498;

    address public constant WETH = 0x94373a4919B3240D86eA41593D5eBa789FEF3848; // holesky address

    constructor() ERC20("MockAtoken", "mAWETH") {}

    /**
     * @dev Mocks the supply function of the Aave v3 pool.
     * @param amount The amount to supply.
     * @param receiver The receiver address.
     */
    function supply(address, uint256 amount, address receiver, uint16) external {
        IERC20(WETH).safeTransferFrom(msg.sender, address(this), amount);
        _mint(receiver, amount);
    }

    /**
     * @dev Mocks the withdraw function of the Aave v3 pool.
     * @param amount The amount to withdraw.
     * @param receiver The receiver address.
     */
    function withdraw(address, uint256 amount, address receiver) external {
        IERC20(WETH).safeTransferFrom(address(this), receiver, amount);
        _burn(msg.sender, amount);
    }

    /**
     * @dev Gets the configuration of the reserve.
     * @return DataTypes.ReserveConfigurationMap The configuration of the reserve.
     */
    function getConfiguration(
        address
    ) external pure returns (DataTypes.ReserveConfigurationMap memory) {
        return DataTypes.ReserveConfigurationMap(MOCK_CONFIG_DATA);
    }
}
