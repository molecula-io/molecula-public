// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts (last updated v5.0.0) (interfaces/IERC7540.sol)

// See  https://github.com/OpenZeppelin/openzeppelin-contracts/pull/5294/files

pragma solidity ^0.8.23;

/// @title IERC7575.
/// @notice Interface for managing ERC7575 vault operations.
/// @dev Defines core functions for deposit, withdraw, and conversion operations.
interface IERC7575 {
    // ============ Events ============

    /// @dev Emitted when assets are deposited into the Vault.
    /// @param sender Sender's address.
    /// @param owner Owner's address.
    /// @param assets Amount of assets deposited.
    /// @param shares Amount of shares minted.
    event Deposit(
        address indexed sender,
        address indexed owner,
        uint256 indexed assets,
        uint256 shares
    );

    /// @dev Emitted when assets are withdrawn from the Vault.
    /// @param sender Sender's address.
    /// @param receiver Receiver's address.
    /// @param owner Owner's address.
    /// @param assets Amount of assets withdrawn.
    /// @param shares Amount of shares burned.
    event Withdraw(
        address indexed sender,
        address indexed receiver,
        address indexed owner,
        uint256 assets,
        uint256 shares
    );

    // ============ Core Functions ============

    /// @dev Deposits assets into the Vault and mints shares.
    /// @param assets Amount of assets to deposit.
    /// @param receiver Address to receive the shares.
    /// @return shares Amount of shares minted.
    function deposit(uint256 assets, address receiver) external returns (uint256 shares);

    /// @dev Mints shares by depositing assets.
    /// @param shares Amount of shares to mint.
    /// @param receiver Address to receive the shares.
    /// @return assets Amount of assets required.
    function mint(uint256 shares, address receiver) external returns (uint256 assets);

    /// @dev Withdraws assets from the Vault and burns shares.
    /// @param assets Amount of assets to withdraw.
    /// @param receiver Address to receive the assets.
    /// @param owner Owner's address.
    /// @return shares Amount of shares burned.
    function withdraw(
        uint256 assets,
        address receiver,
        address owner
    ) external returns (uint256 shares);

    /// @dev Redeems shares for assets.
    /// @param shares Amount of shares to redeem.
    /// @param receiver Address to receive the assets.
    /// @param owner Owner's address.
    /// @return assets Amount of assets received.
    function redeem(
        uint256 shares,
        address receiver,
        address owner
    ) external returns (uint256 assets);

    // ============ View Functions ============

    /// @dev Returns the address of the underlying token used for the Vault.
    /// @return assetTokenAddress Address of the underlying token.
    function asset() external view returns (address assetTokenAddress);

    /// @dev Returns the address of the share token.
    /// @return shareTokenAddress Address of the share token.
    function share() external view returns (address shareTokenAddress);

    /// @dev Returns the amount of shares to exchange for the given assets.
    /// @param assets Amount of assets to convert.
    /// @return shares Amount of shares to receive.
    function convertToShares(uint256 assets) external view returns (uint256 shares);

    /// @dev Returns the amount of assets to exchange for the given shares.
    /// @param shares Amount of shares to convert.
    /// @return assets Amount of assets to receive.
    function convertToAssets(uint256 shares) external view returns (uint256 assets);

    /// @dev Returns the total amount of assets managed by the Vault.
    /// @return totalManagedAssets Total amount of managed assets.
    function totalAssets() external view returns (uint256 totalManagedAssets);

    /// @dev Returns the maximum amount of assets that can be deposited.
    /// @param receiver Receiver's address.
    /// @return maxAssets Maximum amount of assets that can be deposited.
    function maxDeposit(address receiver) external view returns (uint256 maxAssets);

    /// @dev Returns the amount of shares to mint for a deposit.
    /// @param assets Amount of assets to deposit.
    /// @return shares Amount of shares to mint.
    function previewDeposit(uint256 assets) external view returns (uint256 shares);

    /// @dev Returns the maximum amount of shares that can be minted.
    /// @param receiver Receiver's address.
    /// @return maxShares Maximum amount of shares that can be minted.
    function maxMint(address receiver) external view returns (uint256 maxShares);

    /// @dev Returns the amount of assets that would be required for a mint.
    /// @param shares Amount of shares to mint.
    /// @return assets Amount of assets to be required.
    function previewMint(uint256 shares) external view returns (uint256 assets);

    /// @dev Returns the maximum amount of assets that can be withdrawn.
    /// @param owner Owner's address.
    /// @return maxAssets Maximum amount of assets that can be withdrawn.
    function maxWithdraw(address owner) external view returns (uint256 maxAssets);

    /// @dev Returns the amount of shares to burn for a withdrawal.
    /// @param assets Amount of assets to withdraw.
    /// @return shares Amount of shares to burn.
    function previewWithdraw(uint256 assets) external view returns (uint256 shares);

    /// @dev Returns the maximum amount of shares that can be redeemed.
    /// @param owner Owner's address.
    /// @return maxShares Maximum amount of shares that can be redeemed.
    function maxRedeem(address owner) external view returns (uint256 maxShares);

    /// @dev Returns the amount of assets to receive for a redemption.
    /// @param shares Amount of shares to redeem.
    /// @return assets Amount of assets to receive.
    function previewRedeem(uint256 shares) external view returns (uint256 assets);
}

interface IERC7575Share {
    // ============ Events ============

    /// @dev Emitted when a vault is updated for an asset.
    /// @param asset Token's address.
    /// @param vault Vault's address.
    event VaultUpdate(address indexed asset, address indexed vault);

    // ============ View Functions ============

    /// @dev Returns the address of the Vault for the given asset.
    /// @param asset ERC-20 token to deposit into the Vault.
    /// @return Vault's address for the given asset.
    function vault(address asset) external view returns (address);
}
