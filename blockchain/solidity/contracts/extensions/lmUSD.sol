// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.30;

import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {IdGenerator} from "./../common/IdGenerator.sol";
import {RebaseERC20} from "./../common/rebase/RebaseERC20.sol";
import {ValueValidator} from "./../common/ValueValidator.sol";
import {IWrappedRebaseAsset} from "../coreV2/WrappedTokens/interfaces/IWrappedRebaseAsset.sol";
import {IlmUSD} from "./interfaces/IlmUSD.sol";

/// @notice LMUSD allows users to lock their mUSD holdings for a fixed duration.
// The duration works with an unlock period to unlock enhanced yield rates immediately.
// The increased yield is funded by redistributing the yield forfeited by wmUSD holders.
contract LMUSD is IlmUSD, ERC721Enumerable, Ownable2Step, IdGenerator, ValueValidator {
    using SafeCast for uint256;
    using SafeERC20 for RebaseERC20;

    /// @inheritdoc IlmUSD
    RebaseERC20 public immutable MUSD;

    /// @inheritdoc IlmUSD
    address public immutable WMUSD_TOKEN;

    /// @inheritdoc IlmUSD
    mapping(uint256 tokenId => LockInfo) public lockInfos;

    /// @inheritdoc IlmUSD
    uint256 public mUSDLockedShares;

    /// @dev Possible periods for locking the user's mUSD tokens.
    uint128[] internal _periods;

    /// @inheritdoc IlmUSD
    mapping(uint128 period => PeriodInfo) public periodInfos;

    /**
     * @dev Check whether the period exists.
     * @param period Lock period.
     */
    modifier periodExists(uint128 period) {
        if (!periodInfos[period].exists) {
            revert EPeriodDoesNotExist();
        }
        _;
    }

    /**
     * @dev Constructor for initializing the contract.
     * @param name Token name.
     * @param symbol Token symbol.
     * @param owner Smart contract owner address.
     * @param mUSDAddress mUSD rebase token's address.
     * @param wmUSDAddress wmUSD token address.
     * @param allowedPeriods Lock periods.
     * @param periodMultiplier Multiplier for the lock periods.
     */
    constructor(
        string memory name,
        string memory symbol,
        address owner,
        address mUSDAddress,
        address wmUSDAddress,
        uint128[] memory allowedPeriods,
        uint128[] memory periodMultiplier
    ) Ownable(owner) ERC721(name, symbol) notZeroAddress(mUSDAddress) notZeroAddress(wmUSDAddress) {
        MUSD = RebaseERC20(mUSDAddress);
        WMUSD_TOKEN = wmUSDAddress;

        if (allowedPeriods.length != periodMultiplier.length) {
            revert EBadLength();
        }
        uint256 length = allowedPeriods.length;
        for (uint256 i = 0; i < length; ++i) {
            _addPeriod(allowedPeriods[i], periodMultiplier[i]);
        }
    }

    /// @inheritdoc IlmUSD
    function lock(uint256 mUSDAmount, uint128 period) external {
        // Get lock period information.
        PeriodInfo storage periodInfo = periodInfos[period];

        // Check whether the lock period is allowed.
        if (!periodInfo.isAllowed) {
            revert ENotAllowedPeriod();
        }

        // Get the message sender.
        address sender = _msgSender();

        // Transfer the mUSD token value from the user.
        MUSD.safeTransferFrom(sender, address(this), mUSDAmount);

        // Convert mUSD tokens to shares.
        uint256 shares = MUSD.convertToShares(mUSDAmount);

        // Increase the total locked mUSD shares.
        mUSDLockedShares += shares;

        // Increase the total locked mUSD shares for a specific period.
        periodInfo.mUSDLockedShares += shares;

        // Generate the token ID.
        uint256 tokenId = _generateId();

        // Mint `tokenID` for the sender.
        _mint(sender, tokenId);

        // Create a record for locking mUSD.
        uint128 createdAt = block.timestamp.toUint128();
        lockInfos[tokenId] = LockInfo({shares: shares, period: period, createdAt: createdAt});

        emit Locked(sender, tokenId, shares, period, createdAt);
    }

    /// @inheritdoc IlmUSD
    function sharesOf(
        uint256 tokenId
    ) public view returns (uint256 lockedShares, uint256 dedicatedShares) {
        // Get the lock period information.
        LockInfo memory lockInfo = lockInfos[tokenId];

        lockedShares = lockInfo.shares;

        uint256 yieldShares = IWrappedRebaseAsset(WMUSD_TOKEN).currentYieldShares();
        if (yieldShares > 0) {
            // Calculate the total share weight.
            uint256 totalShareWeight = 0;
            uint256 len = _periods.length;
            for (uint256 i = 0; i < len; ++i) {
                uint128 period = _periods[i];
                PeriodInfo storage periodInfo = periodInfos[period];
                totalShareWeight += periodInfo.multiplier * periodInfo.mUSDLockedShares;
            }

            if (totalShareWeight > 0) {
                // Calculate the `tokenId` shares weight.
                uint256 lockedSharesWeight = lockedShares * periodInfos[lockInfo.period].multiplier;

                dedicatedShares = (yieldShares * lockedSharesWeight) / totalShareWeight;
            }
        }
    }

    /// @inheritdoc IlmUSD
    function balanceOf(uint256 tokenId) external view returns (uint256 balance) {
        (uint256 lockedShares, uint256 dedicatedShares) = sharesOf(tokenId);
        return MUSD.convertToAssets(lockedShares + dedicatedShares);
    }

    /// @inheritdoc IlmUSD
    function unlock(uint256 tokenId) external {
        // Check whether `tokenId` has the owner and if it does, return one.
        address tokenOwner = _requireOwned(tokenId);

        // Check whether the sender is the `tokenId`'s owner.
        if (_msgSender() != tokenOwner) {
            revert ENotAuthorized();
        }

        // Get the `tokenId`'s shares.
        (uint256 lockedShares, uint256 dedicatedShares) = sharesOf(tokenId);

        // Get the lock information.
        LockInfo memory lockInfo = lockInfos[tokenId];

        // Ensure the token can be unlocked.
        if (block.timestamp < uint256(lockInfo.createdAt) + lockInfo.period) {
            revert ETokenIsStillLocked();
        }

        // Decrease the total locked mUSD shares for a specific period.
        periodInfos[lockInfo.period].mUSDLockedShares -= lockInfo.shares;

        // Decrease the total locked mUSD shares.
        mUSDLockedShares -= lockInfo.shares;

        // Burn `tokenId`.
        _burn(tokenId);

        // Grant the dedicated shares to the token owner.
        IWrappedRebaseAsset(WMUSD_TOKEN).distributeYield(tokenOwner, dedicatedShares);

        // Transfer the locked shares to the token owner.
        MUSD.safeTransfer(tokenOwner, MUSD.convertToAssets(lockedShares));

        emit Unlocked(_msgSender(), tokenId, lockInfo.shares, lockInfo.period, lockInfo.createdAt);
    }

    /// @inheritdoc IlmUSD
    function addPeriod(uint128 period, uint128 multiplier) external onlyOwner {
        _addPeriod(period, multiplier);
        emit PeriodAdded(period, multiplier);
    }

    /// @inheritdoc IlmUSD
    function setAllowPeriod(
        uint128 period,
        bool isAllowed
    ) external onlyOwner periodExists(period) {
        // Check that the new value is not equal to the old one.
        if (periodInfos[period].isAllowed == isAllowed) {
            revert EAlreadySet();
        }

        periodInfos[period].isAllowed = isAllowed;
        emit SetAllowPeriod(period, isAllowed);
    }

    /// @inheritdoc IlmUSD
    function deletePeriod(uint256 index, uint128 period) external onlyOwner {
        // Check whether the index and period are correct.
        if (index >= _periods.length || _periods[index] != period) {
            revert EWrongIndexOrPeriod();
        }

        // Check whether the lock period has no shares.
        if (periodInfos[period].mUSDLockedShares != 0) {
            revert EPeriodHasShares();
        }

        // Delete the lock period.
        _periods[index] = _periods[_periods.length - 1];
        _periods.pop();
        delete periodInfos[period];
        emit PeriodDeleted(period);
    }

    /**
     * @dev Add period.
     * @param period Lock period.
     * @param multiplier Multiplier for the lock period.
     */
    function _addPeriod(uint128 period, uint128 multiplier) internal {
        // Check that period does not exist.
        if (periodInfos[period].exists) {
            revert EPeriodIsAlreadyExist();
        }

        // Add the lock period.
        periodInfos[period] = PeriodInfo({
            exists: true,
            isAllowed: true,
            multiplier: multiplier,
            mUSDLockedShares: 0
        });

        _periods.push(period);
    }

    /// @inheritdoc IlmUSD
    function getPeriods() external view returns (uint128[] memory) {
        return _periods;
    }
}
