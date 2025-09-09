// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.30;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {IAgent} from "./../common/interfaces/IAgent.sol";
import {IMoleculaPool} from "./../common/interfaces/IMoleculaPool.sol";
import {ISupplyManager} from "./../common/interfaces/ISupplyManager.sol";
import {PriceCheckerClient} from "./../common/PriceChecker/PriceCheckerClient.sol";
import {WhitelistedExecutor} from "./../coreV2/WhitelistedExecutor.sol";

/**
 * @dev Token parameters.
 * @param token Token address.
 * @param n Normalization to 18 decimals.
 * @param isERC4626 Boolean indicating whether the token is of the ERC-4626 type.
 */
struct TokenParams {
    address token;
    int8 n;
    bool isERC4626;
}

enum TokenType {
    None,
    ERC20, // Value represents the ERC20 token type, not an extension.
    ERC4626
}

/**
 * @dev Token information.
 * @param tokenType Token type.
 * @param isBlocked Boolean flag indicating whether the token is blocked.
 * @param n Normalization to 18 decimals.
 * @param arrayIndex Index in `TokenParams[] pool`.
 * @param valueToRedeem Value to redeem in the token amount.
 */
struct TokenInfo {
    TokenType tokenType;
    bool isBlocked;
    int8 n;
    uint32 arrayIndex;
    uint256 valueToRedeem;
}

/// @notice MoleculaPoolTreasuryV2
contract MoleculaPoolTreasuryV2 is
    Ownable2Step,
    IMoleculaPool,
    WhitelistedExecutor,
    PriceCheckerClient
{
    using SafeERC20 for IERC20;
    using Address for address;

    /// @dev Supply Manager's address.
    address public immutable SUPPLY_MANAGER;

    /// @dev Boolean flag indicating whether the `redeem` function is paused.
    bool public isRedeemPaused;

    /// @dev Boolean flag indicating whether the `execute` function is paused.
    bool public isExecutePaused;

    /// @dev Pool Keeper's address.
    address public poolKeeper;

    /// @dev Account's address that can pause the `redeem` and `execute` functions.
    address public guardian;

    /// @dev Pool of all the supported tokens including the ones of the ERC20 and ERC4626 types.
    TokenParams[] public pool;

    /// @dev Mapping of the ERC20 Pool.
    mapping(address token => TokenInfo) public poolMap;

    /// @dev Error: Not a smart-contract.
    error ENotContract();

    /// @dev Error: Not an ERC20 token pool.
    error ENotERC20PoolToken();

    /// @dev Error: Duplicated token.
    error EDuplicatedToken();

    /// @dev Error: Removed token does not have the zero `valueToRedeem` value.
    error ENotZeroValueToRedeemOfRemovedToken();

    /// @dev Error: Molecula Pool does not have the token.
    error ETokenNotExist();

    /// @dev Error: `msg.sender` is not authorized for some function.
    error EBadSender();

    /// @dev Error: The `redeem` or `execute` function with the blocked token is called.
    error ETokenBlocked();

    /// @dev Error: The `execute` function is called while being paused as the `isExecutePaused` flag is set.
    error EExecutePaused();

    /// @dev Error: The `redeem` function is called while being paused as the `isRedeemPaused` flag is set.
    error ERedeemPaused();

    /// @dev Error: Wrong Owner address during migration.
    error EBadOwner();

    /// @dev Error: Wrong Pool Keeper address during migration.
    error EBadPoolKeeper();

    /// @dev Error: Wrong Guardian address during migration.
    error EBadGuardian();

    /// @dev Emitted when the target has been added in the whitelist.
    /// @param target Address.
    event AddedInWhiteList(address indexed target);

    /// @dev Emitted when the target has been deleted from the whitelist.
    /// @param target Address.
    event DeletedFromWhiteList(address indexed target);

    /// @dev Emitted when the `isExecutePaused` flag is changed.
    /// @param newValue New value.
    event IsExecutePausedChanged(bool indexed newValue);

    /// @dev Emitted when the `isRedeemPaused` flag is changed.
    /// @param newValue New value.
    event IsRedeemPausedChanged(bool indexed newValue);

    /// @dev Emitted when `token` is blocked or unblocked.
    /// @param token Token address.
    /// @param isBlocked New token status.
    event TokenBlockedChanged(address indexed token, bool indexed isBlocked);

    /// @dev Emitted upon adding or removing a new Agent.
    /// @param agent Agent's address.
    /// @param auth Boolean flag indicating if an Agent is added.
    event AgentSet(address indexed agent, bool indexed auth);

    /// @dev Emitted when the Guardian's address is changed.
    /// @param oldGuardian Previous Guardian's address.
    /// @param newGuardian New Guardian's address.
    event GuardianChanged(address indexed oldGuardian, address indexed newGuardian);

    /// @dev Check that `msg.sender` is the Owner or Guardian.
    modifier onlyAuthForPause() {
        if (msg.sender != owner() && msg.sender != guardian) {
            revert EBadSender();
        }
        _;
    }

    /**
     * @dev Initializes the contract setting the initializer address.
     * @param initialOwner Owner's address.
     * @param tokens List of ERC20/ERC4626 tokens.
     * @param poolKeeperAddress Pool Keeper's address.
     * @param supplyManagerAddress Supply Manager's address.
     * @param whiteList List of whitelisted addresses.
     * @param guardianAddress Guardian address that can pause the contract.
     * @param priceChecker_ Price checker contract's address.
     */
    constructor(
        address initialOwner,
        address[] memory tokens,
        address poolKeeperAddress,
        address supplyManagerAddress,
        WhiteList[] memory whiteList,
        address guardianAddress,
        address priceChecker_
    )
        Ownable(initialOwner)
        WhitelistedExecutor(whiteList)
        PriceCheckerClient(priceChecker_)
        notZeroAddress(supplyManagerAddress)
        notZeroAddress(guardianAddress)
    {
        uint256 tokensLength = tokens.length;
        for (uint256 i = 0; i < tokensLength; ++i) {
            _addToken(tokens[i]);
        }

        // slither-disable-next-line missing-zero-check (checked in ERC1271)
        poolKeeper = poolKeeperAddress;
        SUPPLY_MANAGER = supplyManagerAddress;

        guardian = guardianAddress;

        // Validates that the price checker is properly set for each asset.
        _validatePriceCheckers();
    }

    /// @inheritdoc PriceCheckerClient
    function setPriceChecker(address newPriceChecker) public virtual override {
        super.setPriceChecker(newPriceChecker);

        // Validates that the price checker is properly set for each asset.
        _validatePriceCheckers();
    }

    /// @dev Validates that the price checker is properly set for each asset.
    function _validatePriceCheckers() internal virtual {
        // Validates that the price checker is properly set for each asset.
        uint256 len = pool.length;
        for (uint256 i = 0; i < len; ++i) {
            address token = pool[i].token;
            _validatePriceChecker(token);
        }
    }

    /// @dev Check each token's price.
    function _checkPoolPrices() internal virtual {
        uint256 len = pool.length;
        for (uint256 i = 0; i < len; ++i) {
            address token = pool[i].token;
            // If a price feed is set for the token, check that the token price is within the allowed deviation.
            // If the price feed is not set but the asset is present, do nothing.
            // Otherwise, throw an exception.
            checkPrice(token);
        }
    }

    /**
     * @dev Normalizes the value.
     * @param n Normalization to 18 decimals.
     * @param value Value to normalize.
     * @return result Normalized value.
     */
    function _normalize(int8 n, uint256 value) internal pure returns (uint256 result) {
        uint256 multiplier;
        if (n > 0) {
            multiplier = 10 ** uint256(uint8(n));
            result = value * multiplier;
        } else if (n < 0) {
            multiplier = 10 ** uint256(uint8(-n));
            result = value / multiplier;
        } else {
            // n == 0.
            result = value;
        }
        return result;
    }

    /// @dev Convert the token value (sUSDe, USDe, etc) to mUSDe.
    /// @param value Token value.
    /// @param token Token address.
    /// @param n Normalization to 18 decimals.
    /// @param isERC4626 Boolean indicating whether the token is of the ERC-4626 type.
    /// @return mUSDAmount mUSD amount.
    function _tokenAmountTomUSD(
        uint256 value,
        address token,
        int8 n,
        bool isERC4626
    ) private view returns (uint256 mUSDAmount) {
        mUSDAmount = 0;
        if (value > 0) {
            if (isERC4626) {
                // Convert `value` (e.g. mUSDe to USDe) to assets.
                value = IERC4626(token).convertToAssets(value);
            }
            // Note: `value` is in USD (e.g. USDT, USDe, etc).
            mUSDAmount = _normalize(n, value);
        }
    }

    /**
     * @dev Returns the total supply of the pool (TVL).
     * @return supply Total pool supply.
     * @return totalRedeem Total redemption value.
     */
    function totalPoolsSupplyAndRedeem() public view returns (uint256 supply, uint256 totalRedeem) {
        supply = 0;
        totalRedeem = 0;
        uint256 len = pool.length;
        for (uint256 i = 0; i < len; ++i) {
            TokenParams memory tokenParam = pool[i];
            address token = tokenParam.token;

            uint256 balance = IERC20(token).balanceOf(address(this));
            supply += _tokenAmountTomUSD(balance, token, tokenParam.n, tokenParam.isERC4626);

            uint256 redeemValue = poolMap[token].valueToRedeem;
            totalRedeem += _tokenAmountTomUSD(
                redeemValue,
                token,
                tokenParam.n,
                tokenParam.isERC4626
            );
        }
    }

    /**
     * @inheritdoc IMoleculaPool
     */
    function totalSupply() public view returns (uint256 res) {
        (uint256 supply, uint256 redeemValue) = totalPoolsSupplyAndRedeem();
        if (redeemValue > supply) {
            return 0;
        }
        return supply - redeemValue;
    }

    /**
     * @dev Add the token to the Pool.
     * @param token ERC20 token address.
     */
    function _addToken(address token) internal {
        // Ensure that the token is a contract before making a call.
        if (token.code.length == 0) {
            revert ENotContract();
        }

        // Ensure that the token has the `balanceOf()` function.
        if (!_hasBalanceOf(token)) {
            revert ENotERC20PoolToken();
        }

        bool isERC4626 = _hasConvertToAssets(token);

        // Ensure that the token is not duplicated.
        if (poolMap[token].tokenType != TokenType.None) {
            revert EDuplicatedToken();
        }

        // Validates that the price checker is properly set and has the specified asset.
        _validatePriceChecker(token);

        // Add the token to the Pool.
        uint8 decimals;
        if (isERC4626) {
            // For ERC4626 Vault tokens, use the underlying asset’s decimals.
            // We normalize the underlying asset amount (not the Vault token amount)
            // to mUSD when calculating the total pool supply.
            address underlyingAsset = IERC4626(token).asset();
            decimals = IERC20Metadata(underlyingAsset).decimals();
        } else {
            decimals = IERC20Metadata(token).decimals();
        }
        int8 n = 18 - int8(decimals);
        pool.push(TokenParams(token, n, isERC4626));
        poolMap[token] = TokenInfo({
            tokenType: isERC4626 ? TokenType.ERC4626 : TokenType.ERC20,
            n: n,
            arrayIndex: uint32(pool.length - 1),
            valueToRedeem: 0,
            isBlocked: false
        });
    }

    /**
     * @dev Remove the token from the Pool.
     * @param token Token address.
     */
    function _removeToken(address token) internal {
        // Check if the token exists in the Pool.
        if (poolMap[token].tokenType == TokenType.None) {
            revert ETokenNotExist();
        }

        // Get the token balance and transfer to the Owner.
        uint256 balance = IERC20(token).balanceOf(address(this));
        if (balance > 0) {
            // Transfer the remaining balance to the Owner.
            IERC20(token).safeTransfer(owner(), balance);
        }

        // Check if the token has pending redemptions.
        if (poolMap[token].valueToRedeem > 0) {
            revert ENotZeroValueToRedeemOfRemovedToken();
        }

        // Remove the token from the Pool array and update the mappings.
        uint32 i = poolMap[token].arrayIndex;
        TokenParams storage lastElement = pool[pool.length - 1];
        pool[i] = lastElement;
        poolMap[lastElement.token].arrayIndex = i;
        delete poolMap[token];
        pool.pop();
    }

    /**
     * @dev Check if the token has the `balanceOf` function.
     * @param token Token address.
     * @return has `True` if the token has the `balanceOf` function.
     */
    function _hasBalanceOf(address token) internal view returns (bool has) {
        // slither-disable-next-line low-level-calls
        (bool success, bytes memory data) = token.staticcall(
            abi.encodeWithSelector(IERC20.balanceOf.selector, address(this)) // Test with the current contract address.
        );

        return success && data.length == 32; // Must return a uint256 value.
    }

    /**
     * @dev Check whether the token has the `convertToAssets` function.
     * @param token Token address.
     * @return has Boolean indicating whether the token has the `convertToAssets` function.
     */
    function _hasConvertToAssets(address token) internal view returns (bool has) {
        // slither-disable-next-line low-level-calls
        (bool success, bytes memory data) = token.staticcall(
            abi.encodeWithSelector(IERC4626.convertToAssets.selector, uint256(1)) // Test with a dummy value equal to 1 share.
        );

        return success && data.length == 32; // Must return a uint256 value.
    }

    /**
     * @dev Add the token to the Pool.
     * @param token ERC20 token address.
     */
    function addToken(address token) external onlyOwner {
        _addToken(token);
    }

    /**
     * @dev Remove the token from the Pool.
     * @param token Token address.
     */
    function removeToken(address token) external onlyOwner {
        _removeToken(token);
    }

    /**
     * @dev Sets the Pool Keeper's wallet.
     * @param poolKeeperAddress Pool Keeper's wallet.
     */
    function setPoolKeeper(
        address poolKeeperAddress
    ) external onlyOwner notZeroAddress(poolKeeperAddress) {
        poolKeeper = poolKeeperAddress;
    }

    /**
     * @inheritdoc IMoleculaPool
     */
    function deposit(
        address token,
        uint256 /*requestId*/,
        address from,
        uint256 value
    ) external only(SUPPLY_MANAGER) returns (uint256 formattedValue) {
        // Check each token's price.
        _checkPoolPrices();

        if (poolMap[token].tokenType == TokenType.None) {
            revert ETokenNotExist();
        }
        if (poolMap[token].tokenType == TokenType.ERC20) {
            formattedValue = _normalize(poolMap[token].n, value);
        } else {
            uint256 assets = IERC4626(token).convertToAssets(value);
            formattedValue = _normalize(poolMap[token].n, assets);
        }
        // Transfer assets to the token holder.
        // slither-disable-next-line arbitrary-send-erc20
        IERC20(token).safeTransferFrom(from, address(this), value);
        return formattedValue;
    }

    /// @inheritdoc IMoleculaPool
    function requestRedeem(
        address token,
        uint256 value // In mUSD.
    ) external only(SUPPLY_MANAGER) returns (uint256 tokenValue) {
        // Check each token's price.
        _checkPoolPrices();

        if (poolMap[token].tokenType == TokenType.None) {
            revert ETokenNotExist();
        }

        if (poolMap[token].tokenType == TokenType.ERC20) {
            // Convert the provided mUSD token value to the given token value (e.g. USDT).
            tokenValue = _normalize(-poolMap[token].n, value);
            // Must reduce the Pool amount to correctly calculate `totalSupply` upon redemption.
            poolMap[token].valueToRedeem += tokenValue;
        } else {
            // Convert the provided mUSD token value to stable USD assets (e.g. USDe).
            uint256 assets = _normalize(-poolMap[token].n, value);
            // Convert stable USD assets (e.g. USDe) to the given token value (e.g. sUSDe).
            tokenValue = IERC4626(token).convertToShares(assets);
            // Must reduce the Pool amount to correctly calculate `totalSupply` upon redemption.
            poolMap[token].valueToRedeem += tokenValue;
        }
    }

    /**
     * @dev Redeem tokens.
     * @param requestIds Request IDs.
     */
    function redeem(uint256[] calldata requestIds) external payable {
        if (isRedeemPaused) {
            revert ERedeemPaused();
        }

        if (requestIds.length == 0) {
            revert EEmptyArray();
        }
        // Call the Supply Manager's `redeem` method.
        // Receive the corresponding ERC20 token and total value redeemed.
        // Note: `value` is in the token amount (e.g. sUSDe).
        // slither-disable-next-line reentrancy-benign
        (address token, uint256 value) = ISupplyManager(SUPPLY_MANAGER).redeem{value: msg.value}(
            address(this),
            requestIds
        );

        if (poolMap[token].isBlocked) {
            revert ETokenBlocked();
        }

        // Reduce the value to redeem for the correct `totalSupply` calculation.
        poolMap[token].valueToRedeem -= value;
    }

    /**
     * @dev Returns the list of the ERC20 Pool.
     * @return result List of the ERC20 Pool.
     */
    function getTokenPool() external view returns (TokenParams[] memory result) {
        return pool;
    }

    /**
     * @dev Execute transactions on behalf of the whitelisted contract.
     * Allows the `approve` calls to tokens in `poolMap` and `poolMap` without whitelisting.
     * @param target Address.
     * @param data Encoded function data.
     * @return result Result of the function call.
     */
    function execute(
        address target,
        bytes calldata data
    ) external payable only(poolKeeper) returns (bytes memory result) {
        if (isExecutePaused) {
            revert EExecutePaused();
        }

        if (poolMap[target].isBlocked) {
            revert ETokenBlocked();
        }

        return _execute(target, data, msg.value);
    }

    /**
     * @dev Authorizes a new Agent.
     * @param agent Agent's address.
     * @param auth Boolean flag indicating whether the Agent is authorized.
     */
    function _setAgent(address agent, bool auth) internal {
        IERC20 token = IERC20(IAgent(agent).getERC20Token());
        if (auth) {
            token.forceApprove(agent, type(uint256).max);
        } else {
            token.forceApprove(agent, 0);
        }

        // Validates that the price checker is properly set and has the specified asset.
        _validatePriceChecker(address(token));
    }

    /// @inheritdoc IMoleculaPool
    function setAgent(address agent, bool auth) external only(SUPPLY_MANAGER) {
        _setAgent(agent, auth);

        // Emit an event to log the operation.
        emit AgentSet(agent, auth);
    }

    /// @dev Transfer all the balance of `fromAddress` to this contract.
    /// @param token Token.
    /// @param fromAddress Address from which the funds are taken from.
    function _transferAllBalance(IERC20 token, address fromAddress) internal {
        uint256 balance = token.balanceOf(fromAddress);
        if (balance > 0) {
            // slither-disable-next-line arbitrary-send-erc20
            token.safeTransferFrom(fromAddress, address(this), balance);
        }
    }

    /// @inheritdoc IMoleculaPool
    function migrate(address oldMoleculaPool) external only(SUPPLY_MANAGER) {
        MoleculaPoolTreasuryV2 oldMPT = MoleculaPoolTreasuryV2(oldMoleculaPool);

        // Check that the migration source contract has the same configurations.
        // Note: The `SUPPLY_MANAGER` address is already checked as the function can be called only by `SUPPLY_MANAGER`.
        if (oldMPT.owner() != owner()) {
            revert EBadOwner();
        }
        if (oldMPT.poolKeeper() != poolKeeper) {
            revert EBadPoolKeeper();
        }
        if (oldMPT.guardian() != guardian) {
            revert EBadGuardian();
        }

        // Copy the pause states: the old contract's `isRedeemPaused` and `isExecutePaused` flags
        // to maintain similar execution pauses in the new contract.
        _setRedeemPaused(oldMPT.isRedeemPaused());
        _setExecutePaused(oldMPT.isExecutePaused());

        // Migrate the token Pool configurations and balances.
        TokenParams[] memory oldPool = oldMPT.getTokenPool();
        uint256 oldPoolLength = oldPool.length;
        for (uint256 i = 0; i < oldPoolLength; ++i) {
            // Get the token from the old contract.
            address token = oldPool[i].token;
            if (poolMap[token].tokenType == TokenType.None) {
                _addToken(token);
            }

            // Get the token info from the old contract.
            // slither-disable-next-line unused-return
            (, bool isBlocked, , , uint256 valueToRedeem) = oldMPT.poolMap(token);

            // Migrate the token settings.
            poolMap[token].valueToRedeem = valueToRedeem;
            poolMap[token].isBlocked = isBlocked;

            // Transfer the token balance.
            _transferAllBalance(IERC20(token), oldMoleculaPool);
        }

        // Set up Agents.
        address[] memory agents = ISupplyManager(SUPPLY_MANAGER).getAgents();
        uint256 agentsLength = agents.length;
        for (uint256 i = 0; i < agentsLength; ++i) {
            _setAgent(agents[i], true);
        }

        // Check each token's price.
        _checkPoolPrices();
    }

    /// @dev Change the Guardian's address.
    /// @param newGuardian New Guardian's address.
    function changeGuardian(address newGuardian) external onlyOwner notZeroAddress(newGuardian) {
        address oldGuardian = guardian;
        guardian = newGuardian;
        emit GuardianChanged(oldGuardian, newGuardian);
    }

    /// @dev Set a new value for the `isExecutePaused` flag.
    /// @param newValue New value.
    function _setExecutePaused(bool newValue) private {
        if (isExecutePaused != newValue) {
            isExecutePaused = newValue;
            emit IsExecutePausedChanged(newValue);
        }
    }

    /// @dev Set a new value for the `isRedeemPaused` flag.
    /// @param newValue New value.
    function _setRedeemPaused(bool newValue) private {
        if (isRedeemPaused != newValue) {
            isRedeemPaused = newValue;
            emit IsRedeemPausedChanged(newValue);
        }
    }

    /// @dev Pause the `execute` function.
    function pauseExecute() external onlyAuthForPause {
        _setExecutePaused(true);
    }

    /// @dev Unpause the `execute` function.
    function unpauseExecute() external onlyOwner {
        _setExecutePaused(false);
    }

    /// @dev Pause the `redeem` function.
    function pauseRedeem() external onlyAuthForPause {
        _setRedeemPaused(true);
    }

    /// @dev Unpause the `redeem` function.
    function unpauseRedeem() external onlyOwner {
        _setRedeemPaused(false);
    }

    /// @dev Pause the `execute` and `redeem` functions.
    function pauseAll() external onlyAuthForPause {
        _setExecutePaused(true);
        _setRedeemPaused(true);
    }

    /// @dev Unpause the `execute` and `redeem` functions.
    function unpauseAll() external onlyOwner {
        _setExecutePaused(false);
        _setRedeemPaused(false);
    }

    /// @dev Block & unblock the `execute` and `redeem` operations with the token from the Pool.
    /// @param token Token address.
    /// @param isBlocked Boolean flag indicating whether the token is blocked.
    function setBlockToken(address token, bool isBlocked) external onlyOwner {
        TokenInfo storage tokenInfo = poolMap[token];
        if (tokenInfo.tokenType == TokenType.None) {
            revert ETokenNotExist();
        }

        if (tokenInfo.isBlocked != isBlocked) {
            tokenInfo.isBlocked = isBlocked;
            emit TokenBlockedChanged(token, isBlocked);
        }
    }

    /// @inheritdoc Ownable2Step
    function transferOwnership(address newOwner) public virtual override(Ownable, Ownable2Step) {
        super.transferOwnership(newOwner);
    }

    /// @inheritdoc Ownable2Step
    function _transferOwnership(address newOwner) internal virtual override(Ownable, Ownable2Step) {
        super._transferOwnership(newOwner);
    }

    /// @inheritdoc WhitelistedExecutor
    function _isAllowedForApprove(
        address target
    ) internal virtual override returns (bool isAllowed) {
        isAllowed = poolMap[target].tokenType != TokenType.None;
    }
}
