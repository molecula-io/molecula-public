// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

// solhint-disable-next-line no-unused-import
import {IOracleV2} from "../../coreV2/interfaces/IOracleV2.sol";

/**
 * @title MockOracle
 */
contract MockOracleV2 is Ownable, IOracleV2 {
    /// @dev Total pool value tracked by the Oracle.
    uint256 private _pool;

    /// @dev Total shares value tracked by the Oracle.
    uint256 private _shares;

    /**
     * @dev Constructor that initializes the smart contract by setting the initial shares, pool value, and its owner.
     * @param initialShares Shares number to set for the Oracle specified during contract creation.
     * @param initialPool Pool value to set for the Oracle specified during contract creation.
     * @param initialOwner Smart contract owner address.
     */
    constructor(
        uint256 initialShares,
        uint256 initialPool,
        address initialOwner
    ) Ownable(initialOwner) {
        _pool = initialPool;
        _shares = initialShares;
    }

    function setTotalPoolSupply(uint256 pool) external onlyOwner {
        _pool = pool;
    }

    function setTotalSharesSupply(uint256 shares) external onlyOwner {
        _shares = shares;
    }

    function setTotalSupply(uint256 pool, uint256 shares) external onlyOwner {
        _pool = pool;
        _shares = shares;
    }

    function getTotalPoolSupply() external view returns (uint256 pool) {
        return _pool;
    }

    function getTotalSharesSupply() external view returns (uint256 shares) {
        return _shares;
    }

    function getTotalSupply() public view returns (uint256 pool, uint256 shares) {
        return (_pool, _shares);
    }

    function convertToShares(
        uint256 assets
    ) external view virtual override returns (uint256 shares) {
        (uint256 pool, uint256 poolShares) = getTotalSupply();
        shares = (assets * poolShares) / pool;
    }

    function convertToAssets(
        uint256 shares
    ) external view virtual override returns (uint256 assets) {
        (uint256 pool, uint256 poolShares) = getTotalSupply();
        assets = (shares * pool) / poolShares;
    }
}
