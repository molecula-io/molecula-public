// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts (last updated v5.0.0) (interfaces/IERC7540.sol)

// See  https://github.com/OpenZeppelin/openzeppelin-contracts/pull/5294/files

pragma solidity ^0.8.23;

/// @title IERC7540Operator.
/// @notice Interface for managing ERC7540 operator permissions.
/// @dev Defines core functions for operator approval and validation.
interface IERC7540Operator {
    // ============ Events ============

    /// @dev Emitted when an operator is set.
    /// @param controller Controller's address.
    /// @param operator Operator's address
    /// @param approved Approval status.
    event OperatorSet(address indexed controller, address indexed operator, bool indexed approved);

    // ============ Core Functions ============

    /// @dev Sets or removes an operator for the caller.
    /// @param operator Operator's address.
    /// @param approved Approval status.
    /// @return Boolean flag indicating whether the call has been executed successfully.
    function setOperator(address operator, bool approved) external returns (bool);

    // ============ View Functions ============

    /// @dev Returns the boolean flag indicating whether an operator is approved for a controller.
    /// @param controller Controller's address.
    /// @param operator Operator's address.
    /// @return status Approval status.
    function isOperator(address controller, address operator) external view returns (bool status);
}

/// @title IERC7540Deposit.
/// @notice Interface for managing ERC7540 deposit operations.
/// @dev Defines core functions for deposit requests and processing.
interface IERC7540Deposit {
    // ============ Events ============

    /// @dev Emitted when a deposit request is created.
    /// @param controller Controller's address.
    /// @param owner Owner's address.
    /// @param requestId Request's ID.
    /// @param sender Sender's address.
    /// @param assets Amount of assets to deposit.
    event DepositRequest(
        address indexed controller,
        address indexed owner,
        uint256 indexed requestId,
        address sender,
        uint256 assets
    );

    // ============ Core Functions ============

    /// @dev Transfers assets from sender into the Vault and requests an asynchronous deposit.
    /// @param assets Amount of deposited assets to transfer from the owner.
    /// @param controller Controller operating the request.
    /// @param owner Source of the deposited assets.
    /// @return requestId Created request's ID.
    function requestDeposit(
        uint256 assets,
        address controller,
        address owner
    ) external returns (uint256 requestId);

    /// @dev Deposits assets and mints Vault shares to the receiver.
    /// @param assets Amount of assets to deposit.
    /// @param receiver Address to receive the shares.
    /// @param controller Request's controller.
    /// @return shares Amount of shares minted.
    function deposit(
        uint256 assets,
        address receiver,
        address controller
    ) external returns (uint256 shares);

    /// @dev Mints Vault shares to the receiver by claiming the controller's request.
    /// @param shares Amount of shares to mint.
    /// @param receiver Address to receive the shares.
    /// @param controller Request's controller.
    /// @return assets Amount of assets required.
    function mint(
        uint256 shares,
        address receiver,
        address controller
    ) external returns (uint256 assets);

    // ============ View Functions ============

    /// @dev Returns the amount of requested assets in the `Pending` state.
    /// @param requestId Request's ID.
    /// @param controller Request's controller.
    /// @return pendingAssets Amount of pending assets.
    function pendingDepositRequest(
        uint256 requestId,
        address controller
    ) external view returns (uint256 pendingAssets);

    /// @dev Returns the amount of requested assets in the `Claimable` state.
    /// @param requestId Request's ID.
    /// @param controller Request's controller.
    /// @return claimableAssets Amount of claimable assets.
    function claimableDepositRequest(
        uint256 requestId,
        address controller
    ) external view returns (uint256 claimableAssets);
}

/// @title IERC7540Redeem.
/// @notice Interface for managing ERC7540 redeem operations.
/// @dev Defines core functions for redeem requests and processing.
interface IERC7540Redeem {
    // ============ Events ============

    /// @dev Emitted when a redeem request is created.
    /// @param controller Controller's address.
    /// @param owner Owner's address.
    /// @param requestId Request's ID.
    /// @param sender Sender's address.
    /// @param assets Amount of assets to redeem.
    event RedeemRequest(
        address indexed controller,
        address indexed owner,
        uint256 indexed requestId,
        address sender,
        uint256 assets
    );

    // ============ Core Functions ============

    /// @dev Requests an asynchronous redemption.
    /// @param shares Amount of shares to be redeemed.
    /// @param controller Request's controller.
    /// @param owner Source of the shares.
    /// @return requestId Created request's ID.
    function requestRedeem(
        uint256 shares,
        address controller,
        address owner
    ) external returns (uint256 requestId);

    // ============ View Functions ============

    /// @dev Returns the amount of requested shares in the `Pending` state.
    /// @param requestId Request's ID.
    /// @param controller Request's controller.
    /// @return pendingShares Amount of pending shares.
    function pendingRedeemRequest(
        uint256 requestId,
        address controller
    ) external view returns (uint256 pendingShares);

    /// @dev Returns the amount of requested shares in the `Claimable` state.
    /// @param requestId Request's ID.
    /// @param controller Request's controller.
    /// @return claimableShares Amount of claimable shares.
    function claimableRedeemRequest(
        uint256 requestId,
        address controller
    ) external view returns (uint256 claimableShares);
}
