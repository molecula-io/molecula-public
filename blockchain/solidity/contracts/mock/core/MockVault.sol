// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.23;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IIssuer} from "../../coreV2/interfaces/IIssuer.sol";

contract MockVault is Ownable {
    address public immutable MOLECULA_TOKEN;

    constructor(address initialOwner, address moleculaToken) Ownable(initialOwner) {
        MOLECULA_TOKEN = moleculaToken;
    }

    function mint(address user, uint256 shares) external onlyOwner {
        IIssuer(MOLECULA_TOKEN).mint(user, shares);
    }

    /// @notice Same as IERC7575.asset.
    /// @dev Returns the address of the underlying token used for the Vault.
    /// @return assetTokenAddress Address of the underlying token.
    function asset() external view returns (address assetTokenAddress) {
        return address(this);
    }
}
