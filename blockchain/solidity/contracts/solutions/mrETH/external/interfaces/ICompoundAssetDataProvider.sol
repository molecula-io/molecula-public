/**
 * Link to original contract https://etherscan.io/address/0x63baa2ebec4f7ea0bbbb0cb0ff75c088526400a8#code
 */
// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.28;

interface ICompoundAssetDataProvider {
    struct AssetInfo {
        uint8 offset;
        address asset;
        address priceFeed;
        uint64 scale;
        uint64 borrowCollateralFactor;
        uint64 liquidateCollateralFactor;
        uint64 liquidationFactor;
        uint128 supplyCap;
    }

    struct TotalsCollateral {
        uint128 totalSupplyAsset;
        uint128 _reserved;
    }

    /**
     * @dev Returns the total supply of an asset.
     * @param asset The address of the asset.
     * @return TotalsCollateral memory The total supply of the asset.
     */
    function totalsCollateral(address asset) external view returns (TotalsCollateral memory);

    /**
     * @dev Returns the asset info by address.
     * @param asset The address of the asset.
     * @return AssetInfo memory The asset info.
     */
    function getAssetInfoByAddress(address asset) external view returns (AssetInfo memory);
}
