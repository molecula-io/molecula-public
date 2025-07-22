// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import {IERC20Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Context} from "@openzeppelin/contracts/utils/Context.sol";
import {ValueValidator} from "./../../common/ValueValidator.sol";
import {IRebaseERC20V2} from "./interfaces/IRebaseERC20V2.sol";
import {IShare} from "./interfaces/IShare.sol";
import {ShareToken} from "./ShareToken.sol";

/// @title RebaseERC20V2.
/// @notice Contract for implementing the RebaseERC20V2 functionality.
/// @dev Extends RebaseERC20.sol with additional features.
abstract contract RebaseERC20V2 is
    IRebaseERC20V2,
    IERC20,
    IERC20Metadata,
    IERC20Errors,
    Context,
    ValueValidator,
    ShareToken
{
    // ============ State Variables ============

    /// @dev Token decimals.
    uint8 internal immutable _DECIMALS;

    /// @dev Mapping of account addresses to their respective token balances.
    mapping(address => uint256) internal _shares;

    /// @dev Mapping of account addresses to their respective mapping of spender addresses to token allowances.
    mapping(address => mapping(address => uint256)) internal _allowances;

    /// @inheritdoc IERC20Metadata
    string public name;

    /// @inheritdoc IERC20Metadata
    string public symbol;

    /// @inheritdoc IShare
    uint256 public localTotalShares;

    // ============ Constructor ============

    /// @dev Initializes the contract with specified parameters.
    /// @param tokenName Token name.
    /// @param tokenSymbol Token symbol.
    /// @param tokenDecimals Token decimals.
    constructor(string memory tokenName, string memory tokenSymbol, uint8 tokenDecimals) {
        name = tokenName;
        symbol = tokenSymbol;
        _DECIMALS = tokenDecimals;
    }

    // ============ Core Functions ============

    /// @inheritdoc IERC20
    function transfer(address to, uint256 value) external virtual override returns (bool result) {
        address owner = _msgSender();
        _transfer(owner, to, value);
        return true;
    }

    /// @inheritdoc IERC20
    function approve(
        address spender,
        uint256 value
    ) external virtual override returns (bool result) {
        address owner = _msgSender();
        _approve(owner, spender, value);
        return true;
    }

    /// @inheritdoc IERC20
    function transferFrom(
        address from,
        address to,
        uint256 value
    ) external virtual override returns (bool result) {
        address spender = _msgSender();
        _spendAllowance(from, spender, value);
        _transfer(from, to, value);
        return true;
    }

    // ============ View Functions ============

    /// @inheritdoc IShare
    function sharesOf(address user) external view virtual override returns (uint256 shares) {
        return _shares[user];
    }

    /// @inheritdoc IERC20
    function balanceOf(address user) external view virtual override returns (uint256 balance) {
        return convertToAssets(_shares[user]);
    }

    /// @inheritdoc IERC20Metadata
    function decimals() external view virtual override returns (uint8 tokenDecimals) {
        return _DECIMALS;
    }

    /// @inheritdoc IERC20
    function allowance(
        address owner,
        address spender
    ) public view virtual override returns (uint256 amount) {
        return _allowances[owner][spender];
    }

    // ============ Internal Functions ============

    /// @dev Moves the specified amount of tokens, emitting a `Transfer` event.
    /// @param from Tokens owner's address.
    /// @param to Tokens recipient's address.
    /// @param value Value to transfer.
    function _transfer(address from, address to, uint256 value) internal virtual {
        if (from == address(0)) {
            revert ERC20InvalidSender(address(0));
        }
        if (to == address(0)) {
            revert ERC20InvalidReceiver(address(0));
        }
        uint256 shares = convertToShares(value);
        _update(from, to, shares);
    }

    /// @dev Transfers the specified amount of shares, emitting `Transfer` events.
    /// @param from Tokens owner's address.
    /// @param to Tokens recipient's address.
    /// @param shares Shares amount to transfer.
    function _update(address from, address to, uint256 shares) internal virtual {
        if (from != address(0)) {
            uint256 fromShares = _shares[from];
            if (fromShares < shares) {
                revert ERC20InsufficientBalance(from, fromShares, shares);
            }
            unchecked {
                // Overflow not possible: shares <= fromShares.
                _shares[from] = fromShares - shares;
            }
        }

        if (to != address(0)) {
            // Overflow check required: balance + shares must be a uint256 value.
            _shares[to] += shares;
        }

        // Convert the shares to the relevant value for proper event emitting.
        uint256 assets = convertToAssets(shares);
        emit Transfer(from, to, assets);
        // Emit the `Transfer` event with the value of shares.
        emit TransferShares(from, to, shares);
    }

    /// @dev Creates new shares and assigns them to the specified account.
    /// @param account Minted tokens recipient's address.
    /// @param shares Shares amount to mint.
    function _mint(address account, uint256 shares) internal virtual {
        if (account == address(0)) {
            revert ERC20InvalidReceiver(address(0));
        }
        _update(address(0), account, shares);
        localTotalShares += shares;
    }

    /// @dev Destroys shares from the specified account, lowering the total supply.
    /// @param account Account address whose tokens are to be burnt.
    /// @param shares Shares amount to burn.
    function _burn(address account, uint256 shares) internal virtual {
        if (account == address(0)) {
            revert ERC20InvalidSender(address(0));
        }
        _update(account, address(0), shares);
        localTotalShares -= shares;
    }

    /// @dev Sets the allowance for a spender over the owner's tokens.
    /// @param owner Tokens owner's address.
    /// @param spender Address which will be allowed to spend the tokens.
    /// @param value Value that the address will be allowed to spend.
    function _approve(address owner, address spender, uint256 value) internal virtual {
        _approve(owner, spender, value, true);
    }

    /// @dev Sets the allowance with an optional flag to enable or disable the `Approval` event.
    /// @param owner Tokens owner's address.
    /// @param spender Address allowed to spend the tokens.
    /// @param value Value allowed to be spent for the address.
    /// @param emitEvent Boolean flag indicating whether to emit an `Approval` event.
    function _approve(
        address owner,
        address spender,
        uint256 value,
        bool emitEvent
    ) internal virtual {
        if (owner == address(0)) {
            revert ERC20InvalidApprover(address(0));
        }
        if (spender == address(0)) {
            revert ERC20InvalidSpender(address(0));
        }
        _allowances[owner][spender] = value;
        if (emitEvent) {
            emit Approval(owner, spender, value);
        }
    }

    /// @dev Updates owner's allowance for the spender based on the spent value.
    /// @param owner Tokens owner's address.
    /// @param spender Address allowed to spend the tokens.
    /// @param value Value amount to spend from the allowance.
    function _spendAllowance(address owner, address spender, uint256 value) internal virtual {
        uint256 currentAllowance = allowance(owner, spender);
        if (currentAllowance < type(uint256).max) {
            if (currentAllowance < value) {
                revert ERC20InsufficientAllowance(spender, currentAllowance, value);
            }
            unchecked {
                _approve(owner, spender, currentAllowance - value, false);
            }
        }
    }
}
