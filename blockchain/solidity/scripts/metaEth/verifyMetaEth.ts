/* eslint-disable no-restricted-syntax, no-await-in-loop */

import { ethers } from 'ethers';
import { type HardhatRuntimeEnvironment } from 'hardhat/types';

import { type ContractsMetaEth, EnvironmentType } from '@molecula-monorepo/blockchain.addresses';

import { ETH_VIRTUAL_OFFSET } from '../../configs';
import { readFromFile } from '../utils';

import { verifyContract } from '../verificationUtils';

import { getChainId, getFeeds, getMetaEthEnvironmentConfig } from './utils';

export async function runVerify(hre: HardhatRuntimeEnvironment) {
    const envType =
        hre.network.name === 'sepolia' ? EnvironmentType.devnet : EnvironmentType['mainnet/beta'];
    const chainId = getChainId(envType);

    const config = getMetaEthEnvironmentConfig(envType);

    const meta: ContractsMetaEth = await readFromFile(`${envType}/contracts_meta_eth.json`);

    const account = (await hre.ethers.getSigners())[0]!;

    await verifyContract(hre, 'MetaPoolTreasury', meta.eth.metaPoolTreasury, [
        config.OWNER,
        config.POOL_KEEPER,
        meta.eth.supplyManagerV2,
        [],
        config.GUARDIAN,
        ethers.ZeroAddress,
    ]);

    await verifyContract(hre, 'SupplyManagerV2WithNative', meta.eth.supplyManagerV2, [
        config.OWNER,
        config.POOL_KEEPER,
        meta.eth.metaPoolTreasury,
        config.APY,
        meta.eth.metaETH,
        ETH_VIRTUAL_OFFSET,
    ]);

    await verifyContract(hre, 'RebaseTokenV2', meta.eth.metaETH, [
        meta.eth.supplyManagerV2,
        account.address,
        config.META_ETH_TOKEN_NAME,
        config.META_ETH_TOKEN_SYMBOL,
        config.META_ETH_TOKEN_DECIMALS,
        meta.eth.supplyManagerV2,
    ]);

    await verifyContract(hre, 'RewardBearingWrapper', meta.eth.wmetaETH, [
        config.WMETA_ETH_TOKEN_NAME,
        config.WMETA_ETH_TOKEN_SYMBOL,
        meta.eth.metaETH,
    ]);

    for (const vault of [meta.eth.stETHVault, meta.eth.wETHVault]) {
        await verifyContract(hre, 'MetaERC20TokenVault', vault, [
            account.address,
            meta.eth.metaETH,
            meta.eth.supplyManagerV2,
            config.GUARDIAN,
        ]);
    }

    await verifyContract(hre, 'MetaNativeTokenVault', meta.eth.nativeTokenVault, [
        account.address,
        meta.eth.metaETH,
        meta.eth.supplyManagerV2,
        config.GUARDIAN,
    ]);

    const withPoolTokens = config.weETH !== '0x';
    const feeds = getFeeds(hre, config, chainId, withPoolTokens);
    await verifyContract(hre, 'PriceChecker', meta.eth.priceChecker, [
        feeds,
        config.OWNER,
        config.META_ETH_TOKEN_DECIMALS,
    ]);
}

async function main() {
    const hardhat = await import('hardhat');
    const hre: HardhatRuntimeEnvironment = hardhat.default;

    await runVerify(hre);
}

main().catch(error => {
    console.error('Failed to verify:', error);
    process.exit(1);
});
