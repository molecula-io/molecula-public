// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.23;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

// solhint-disable-next-line no-unused-import
import {ISetterOracle, IOracle} from "../../common/interfaces/ISetterOracle.sol";

/**
 * @title MockOracle
 * @dev Contract for managing shares and pool information, implementing the ISetterOracle interface.
 */
contract MockOracle is Ownable, ISetterOracle {
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

    /**
     * @inheritdoc ISetterOracle
     */
    function setTotalPoolSupply(uint256 pool) external onlyOwner {
        _pool = pool;
    }

    /**
     * @inheritdoc ISetterOracle
     */
    function setTotalSharesSupply(uint256 shares) external onlyOwner {
        _shares = shares;
    }

    /**
     * @inheritdoc ISetterOracle
     */
    function setTotalSupply(uint256 pool, uint256 shares) external onlyOwner {
        _pool = pool;
        _shares = shares;
    }

    /**
     * @inheritdoc IOracle
     */
    function getTotalPoolSupply() external view returns (uint256 pool) {
        return _pool;
    }

    /**
     * @inheritdoc IOracle
     */
    function getTotalSharesSupply() external view returns (uint256 shares) {
        return _shares;
    }

    /**
     * @inheritdoc IOracle
     */
    function getTotalSupply() external view returns (uint256 pool, uint256 shares) {
        return (_pool, _shares);
    }
}
