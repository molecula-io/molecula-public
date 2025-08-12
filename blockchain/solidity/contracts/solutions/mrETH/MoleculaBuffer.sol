// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.30;

import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ValueValidator} from "./../../common/ValueValidator.sol";
import {IBufferInteractor} from "./interfaces/IBufferInteractor.sol";
import {IMoleculaBuffer} from "./interfaces/IMoleculaBuffer.sol";

/// @title Molecula Buffer Pool contract.
/// @notice Contract for unlimited deposits in the buffer.
contract MoleculaBuffer is ERC20, IBufferInteractor, ValueValidator, Ownable2Step, IMoleculaBuffer {
    using SafeERC20 for IERC20;

    /// @dev Constant for the selector of the the `supply` function.
    bytes4 internal constant _SUPPLY_SELECTOR =
        // solhint-disable-next-line gas-small-strings
        bytes4(keccak256("supply(address,uint256,address)"));

    /// @dev Constant for the selector of the `withdraw` function.
    bytes4 internal constant _WITHDRAW_SELECTOR =
        // solhint-disable-next-line gas-small-strings
        bytes4(keccak256("withdraw(address,uint256,address)"));

    /// @dev WETH token's address.
    address public immutable WETH;

    /// @dev Constructor for the Molecula Buffer contract.
    /// @param name_ The name of the token.
    /// @param symbol_ The symbol of the token.
    /// @param initialOwner_ Contract's initial owner.
    /// @param weth_ WETH token's address.
    constructor(
        string memory name_,
        string memory symbol_,
        address initialOwner_,
        address weth_
    ) ERC20(name_, symbol_) notZeroAddress(weth_) Ownable(initialOwner_) {
        WETH = weth_;
    }

    /// @inheritdoc IMoleculaBuffer
    function supply(address token, uint256 amount, address receiver) external {
        if (token != WETH) {
            revert EInvalidToken();
        }
        IERC20(WETH).safeTransferFrom(msg.sender, address(this), amount);
        _mint(receiver, amount);
    }

    /// @inheritdoc IMoleculaBuffer
    function withdraw(address token, uint256 amount, address receiver) external {
        if (token != WETH) {
            revert EInvalidToken();
        }
        _burn(msg.sender, amount);
        IERC20(WETH).safeTransferFrom(address(this), receiver, amount);
    }

    /// @inheritdoc IBufferInteractor
    function encodeSupply(
        address token,
        address receiver,
        uint256 amount
    ) external pure returns (bytes memory) {
        return abi.encodeWithSelector(_SUPPLY_SELECTOR, token, amount, receiver);
    }

    /// @inheritdoc IBufferInteractor
    function encodeWithdraw(
        address token,
        address receiver,
        uint256 amount
    ) external pure returns (bytes memory) {
        return abi.encodeWithSelector(_WITHDRAW_SELECTOR, token, amount, receiver);
    }

    /// @inheritdoc IBufferInteractor
    function getEthBalance(address, address, address owner) external view returns (uint256) {
        return IERC20(address(this)).balanceOf(owner);
    }

    /// @inheritdoc IBufferInteractor
    function getAvailableAmountToDeposit(
        address,
        address,
        address
    ) external pure returns (uint256) {
        return type(uint256).max;
    }
}
