// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.28;

/* solhint-disable private-vars-leading-underscore */

import "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "./SingleAdminAccessControl.sol";
import "./interfaces/IStakedUSDe.sol";

/**
 * @title StakedUSDe.
 * @notice StakedUSDe contract allows users to:
 * - Stake USDe tokens. 
 * - Earn a portion of:
 *   - The protocol LST.
 *   - The perpetual yield allocated to stakers by the Ethena DAO governance voted yield distribution algorithm.
 * The algorithm seeks to balance the stability of the protocol by:
 *  - Funding its insurance fund and DAO activities.
 *  - Rewarding stakers with a portion of the protocol's yield.
 */
contract StakedUSDe is SingleAdminAccessControl, ReentrancyGuard, ERC20Permit, ERC4626, IStakedUSDe {
  using SafeERC20 for IERC20;

  /* ------------- CONSTANTS ------------- */
  /// @notice Role that is allowed to distribute rewards to this contract.
  bytes32 private constant REWARDER_ROLE = keccak256("REWARDER_ROLE");
  /// @notice Role that is allowed to blacklist and un-blacklist addresses.
  bytes32 private constant BLACKLIST_MANAGER_ROLE = keccak256("BLACKLIST_MANAGER_ROLE");
  /// @notice Role which prevents an address to stake.
  bytes32 private constant SOFT_RESTRICTED_STAKER_ROLE = keccak256("SOFT_RESTRICTED_STAKER_ROLE");
  /// @notice Role which prevents an address to transfer, stake, or unstake. The contract owner can 
  // redirect the address staking balance if it is in the full restricting mode.
  bytes32 private constant FULL_RESTRICTED_STAKER_ROLE = keccak256("FULL_RESTRICTED_STAKER_ROLE");
  /// @notice Vesting period of `lastDistributionAmount`, 
  /// over which it increasingly becomes available to stakers.
  uint256 private constant VESTING_PERIOD = 8 hours;
  /// @notice Minimum non-zero shares amount to prevent the donation attack.
  uint256 private constant MIN_SHARES = 1 ether;

  /* ------------- STATE VARIABLES ------------- */

  /// @notice Amount of the last asset distribution from the controller 
  /// contract into this contract and any unvested remainder at that time.
  uint256 public vestingAmount;

  /// @notice Timestamp of the last asset distribution from 
  /// the controller contract into this contract.
  uint256 public lastDistributionTimestamp;

  /* ------------- MODIFIERS ------------- */

  /// @notice Ensure the input amount is above zero.
  modifier notZero(uint256 amount) {
    if (amount == 0) revert InvalidAmount();
    _;
  }

  /// @notice Ensure the blacklist target is not the owner.
  modifier notOwner(address target) {
    if (target == owner()) revert CantBlacklistOwner();
    _;
  }

  /* ------------- CONSTRUCTOR ------------- */

  /**
   * @notice Constructor for the StakedUSDe contract.
   * @param _asset USDe token's address.
   * @param _initialRewarder Initial rewarder's address.
   * @param _owner Admin role's address.
   *
   */
  constructor(IERC20 _asset, address _initialRewarder, address _owner)
    ERC20("Staked USDe", "sUSDe")
    ERC4626(_asset)
    ERC20Permit("sUSDe")
  {
    if (_owner == address(0) || _initialRewarder == address(0) || address(_asset) == address(0)) {
      revert InvalidZeroAddress();
    }

    _grantRole(REWARDER_ROLE, _initialRewarder);
    _grantRole(DEFAULT_ADMIN_ROLE, _owner);
  }

  /* ------------- EXTERNAL ------------- */

  /**
   * @notice Allows the owner to transfer rewards from the controller contract into this contract.
   * @param amount Amount of rewards to transfer.
   */
  function transferInRewards(uint256 amount) external nonReentrant onlyRole(REWARDER_ROLE) notZero(amount) {
    _updateVestingAmount(amount);
    // Transfer assets from the rewarder to this contract.
    IERC20(asset()).safeTransferFrom(msg.sender, address(this), amount);

    emit RewardsReceived(amount);
  }

  /**
   * @notice Allows the `DEFAULT_ADMIN_ROLE` owner and blacklist managers to blacklist addresses.
   * @param target The address to blacklist.
   * @param isFullBlacklisting Soft or full blacklisting level.
   */
  function addToBlacklist(address target, bool isFullBlacklisting)
    external
    onlyRole(BLACKLIST_MANAGER_ROLE)
    notOwner(target)
  {
    bytes32 role = isFullBlacklisting ? FULL_RESTRICTED_STAKER_ROLE : SOFT_RESTRICTED_STAKER_ROLE;
    _grantRole(role, target);
  }

  /**
   * @notice Allows the `DEFAULT_ADMIN_ROLE` owner and blacklist managers to un-blacklist addresses.
   * @param target The address to un-blacklist.
   * @param isFullBlacklisting Soft or full blacklisting level.
   */
  function removeFromBlacklist(address target, bool isFullBlacklisting) external onlyRole(BLACKLIST_MANAGER_ROLE) {
    bytes32 role = isFullBlacklisting ? FULL_RESTRICTED_STAKER_ROLE : SOFT_RESTRICTED_STAKER_ROLE;
    _revokeRole(role, target);
  }

  /**
   * @notice Allows the owner to rescue tokens accidentally sent to the contract.
   * Note: The owner cannot rescue USDe tokens because:
   * - They functionally remain here.
   * - Belong to stakers but staked USDe can be rescued as:
   *   - They should never remain in this contract.
   *   - A staker may transfer them here accidentally.
   * @param token Token to be rescued.
   * @param amount Amount of tokens to be rescued.
   * @param to Address to send the rescued tokens.
   */
  function rescueTokens(address token, uint256 amount, address to) external nonReentrant onlyRole(DEFAULT_ADMIN_ROLE) {
    if (address(token) == asset()) revert InvalidToken();
    IERC20(token).safeTransfer(to, amount);
  }

  /**
   * @dev Burns the full restricted user amount and mints to the desired owner address.
   * @param from Address to burn the entire balance with `FULL_RESTRICTED_STAKER_ROLE`.
   * @param to Address to mint the entire balance of the `from` parameter.
   */
  function redistributeLockedAmount(address from, address to) external nonReentrant onlyRole(DEFAULT_ADMIN_ROLE) {
    if (hasRole(FULL_RESTRICTED_STAKER_ROLE, from) && !hasRole(FULL_RESTRICTED_STAKER_ROLE, to)) {
      uint256 amountToDistribute = balanceOf(from);
      uint256 usdeToVest = previewRedeem(amountToDistribute);
      _burn(from, amountToDistribute);
      // To address of `address(0)` enabling burning.
      if (to == address(0)) {
        _updateVestingAmount(usdeToVest);
      } else {
        _mint(to, amountToDistribute);
      }

      emit LockedAmountRedistributed(from, to, amountToDistribute);
    } else {
      revert OperationNotAllowed();
    }
  }

  /* ------------- PUBLIC ------------- */

  /**
   * @notice Returns the amount of USDe tokens that are vested in the contract.
   */
  function totalAssets() public view override returns (uint256) {
    return IERC20(asset()).balanceOf(address(this)) - getUnvestedAmount();
  }

  /**
   * @notice Returns the amount of USDe tokens that are unvested in the contract.
   */
  function getUnvestedAmount() public view returns (uint256) {
    uint256 timeSinceLastDistribution = block.timestamp - lastDistributionTimestamp;

    if (timeSinceLastDistribution >= VESTING_PERIOD) {
      return 0;
    }

    uint256 deltaT;
    unchecked {
      deltaT = (VESTING_PERIOD - timeSinceLastDistribution);
    }
    return (deltaT * vestingAmount) / VESTING_PERIOD;
  }

  /// @dev Necessary as both `ERC20` from `ERC20Permit` and `ERC4626` declare `decimals()`.
  function decimals() public pure override(ERC4626, ERC20) returns (uint8) {
    return 18;
  }

  /* ------------- INTERNAL ------------- */

  /// @notice Ensure a non-zero amount of shares does not remain, being exposed to the donation attack.
  function _checkMinShares() internal view {
    uint256 _totalSupply = totalSupply();
    if (_totalSupply > 0 && _totalSupply < MIN_SHARES) revert MinSharesViolation();
  }

  /**
   * @dev Deposit and Mint common workflows.
   * @param caller Sender of assets.
   * @param receiver Address to send shares.
   * @param assets Assets to deposit.
   * @param shares Shares to mint.
   */
  function _deposit(address caller, address receiver, uint256 assets, uint256 shares)
    internal
    override
    nonReentrant
    notZero(assets)
    notZero(shares)
  {
    if (hasRole(SOFT_RESTRICTED_STAKER_ROLE, caller) || hasRole(SOFT_RESTRICTED_STAKER_ROLE, receiver)) {
      revert OperationNotAllowed();
    }
    super._deposit(caller, receiver, assets, shares);
    _checkMinShares();
  }

  /**
   * @dev Withdraw and Redeem common workflows.
   * @param caller Transaction sender.
   * @param receiver Address to send assets.
   * @param _owner Address to burn shares from.
   * @param assets Asset amount to transfer.
   * @param shares Shares to burn.
   */
  function _withdraw(address caller, address receiver, address _owner, uint256 assets, uint256 shares)
    internal
    override
    nonReentrant
    notZero(assets)
    notZero(shares)
  {
    if (
      hasRole(FULL_RESTRICTED_STAKER_ROLE, caller) || hasRole(FULL_RESTRICTED_STAKER_ROLE, receiver)
        || hasRole(FULL_RESTRICTED_STAKER_ROLE, _owner)
    ) {
      revert OperationNotAllowed();
    }

    super._withdraw(caller, receiver, _owner, assets, shares);
    _checkMinShares();
  }

  function _updateVestingAmount(uint256 newVestingAmount) internal {
    if (getUnvestedAmount() > 0) revert StillVesting();

    vestingAmount = newVestingAmount;
    lastDistributionTimestamp = block.timestamp;
  }

  /**
   * @dev Hook that is called before any token transfer that:
   * - Includes minting and burning. 
   * - Disables transfers from or to of the addresses with the `FULL_RESTRICTED_STAKER_ROLE` role.
   */
  function _beforeTokenTransfer(address from, address to, uint256) internal virtual override {
    if (hasRole(FULL_RESTRICTED_STAKER_ROLE, from) && to != address(0)) {
      revert OperationNotAllowed();
    }
    if (hasRole(FULL_RESTRICTED_STAKER_ROLE, to)) {
      revert OperationNotAllowed();
    }
  }

  /**
   * @dev Remove the renounce role access from `AccessControl` to prevent users to resign roles.
   */
  function renounceRole(bytes32, address) public virtual override {
    revert OperationNotAllowed();
  }
}
