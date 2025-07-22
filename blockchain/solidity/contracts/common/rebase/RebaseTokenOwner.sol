// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.24;

import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {IERC20Provider} from "./interfaces/IERC20Provider.sol";
import {IRebaseERC20} from "./../../common/interfaces/IRebaseERC20.sol";
import {Guardian} from "./../../common/pausable/Guardian.sol";
import {IIssuer} from "./../../coreV2/interfaces/IIssuer.sol";
import {VaultContainer} from "./../../coreV2/Tokens/VaultContainer.sol";
import {IRebaseTokenOwner} from "./interfaces/IRebaseTokenOwner.sol";
import {PausableIIssuer} from "./PausableIIssuer.sol";

contract RebaseTokenOwner is
    VaultContainer,
    IRebaseTokenOwner,
    PausableIIssuer,
    Ownable2Step,
    IIssuer
{
    using Address for address;

    // ============ State Variables ============

    /// @dev Rebase token contract's address.
    IRebaseERC20 public immutable REBASE_TOKEN;

    // ============ Constructor ============

    /// @dev Initializes the contract.
    /// @param initialOwner Owner's address.
    /// @param rebaseTokenAddress Rebase token's address.
    /// @param guardianAddress Address of the Guardian that can pause the contract.
    constructor(
        address initialOwner,
        address rebaseTokenAddress,
        address guardianAddress
    ) Ownable(initialOwner) Guardian(guardianAddress) notZeroAddress(rebaseTokenAddress) {
        REBASE_TOKEN = IRebaseERC20(rebaseTokenAddress);
    }

    // ============ Core Functions ============

    /// @inheritdoc IIssuer
    function mint(
        address user,
        uint256 shares
    ) external virtual override checkNotPause(_MINT_SELECTOR) onlyTokenVault {
        // Mint shares for the user.
        REBASE_TOKEN.mint(user, shares);

        emit RequestDeposit(user, shares);
    }

    /// @inheritdoc IIssuer
    function burn(
        address user,
        uint256 shares
    ) external virtual override checkNotPause(_BURN_SELECTOR) onlyTokenVault {
        // Burn shares for the user.
        REBASE_TOKEN.burn(user, shares);

        emit RequestRedeem(user, shares);
    }

    /// @inheritdoc IRebaseTokenOwner
    function callRebaseToken(
        bytes calldata data
    ) external virtual override onlyOwner returns (bytes memory result) {
        // Decode the function selector.
        bytes4 selector = bytes4(data);

        // Check whether the selector is allowed.
        if (
            selector == Ownable2Step.transferOwnership.selector ||
            selector == Ownable.renounceOwnership.selector ||
            selector == IRebaseERC20.mint.selector ||
            selector == IRebaseERC20.burn.selector
        ) {
            revert EBadSelector();
        }

        // Call the RebaseToken's function.
        return address(REBASE_TOKEN).functionCall(data);
    }

    /// @inheritdoc IRebaseTokenOwner
    /// @dev This function skips the pause check as it needs to be callable from other networks
    ///      for cross-chain distributions.
    function distribute(
        address[] calldata users,
        uint256[] calldata shares
    ) external virtual override onlyTokenVault {
        uint256 length = users.length;
        for (uint256 i = 0; i < length; ++i) {
            REBASE_TOKEN.mint(users[i], shares[i]);
        }

        // Emit the `DistributeYield` event to log the operation.
        emit DistributeYield(users, shares);
    }

    // ============ Admin Functions ============

    /// @inheritdoc Ownable2Step
    function transferOwnership(address newOwner) public virtual override(Ownable, Ownable2Step) {
        super.transferOwnership(newOwner);
    }

    // ============ Internal Functions ============

    /// @inheritdoc Ownable2Step
    function _transferOwnership(address newOwner) internal virtual override(Ownable, Ownable2Step) {
        super._transferOwnership(newOwner);
    }

    /// @inheritdoc VaultContainer
    function _getAsset(address tokenVault) internal view virtual override returns (address asset) {
        return IERC20Provider(tokenVault).getERC20Token();
    }
}
