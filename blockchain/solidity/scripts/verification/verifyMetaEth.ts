/* eslint-disable no-restricted-syntax, no-await-in-loop */

import { type HardhatRuntimeEnvironment } from 'hardhat/types';

import { type ContractsMetaEth, EnvironmentType } from '@molecula-monorepo/blockchain.addresses';

import { readFromFile, getEnvironmentConfig } from '../utils/deployUtils';

import { verifyContract } from './verificationUtils';

export async function runVerify(hre: HardhatRuntimeEnvironment) {
    const envType =
        hre.network.name === 'sepolia' ? EnvironmentType.devnet : EnvironmentType['mainnet/beta'];
    const config = getEnvironmentConfig(envType);

    const meta: ContractsMetaEth = await readFromFile(`${envType}/contracts_meta_eth.json`);

    const account = (await hre.ethers.getSigners())[0]!;

    await verifyContract(hre, 'MetaPoolTreasury', meta.eth.metaPoolTreasury, [
        config.META_OWNER,
        config.META_POOL_KEEPER,
        meta.eth.supplyManagerV2,
        [],
        config.META_GUARDIAN,
    ]);

    await verifyContract(hre, 'SupplyManagerV2WithNative', meta.eth.supplyManagerV2, [
        config.META_OWNER,
        config.META_POOL_KEEPER,
        meta.eth.metaPoolTreasury,
        config.META_APY,
        meta.eth.rebaseTokenV2,
    ]);

    await verifyContract(hre, 'RebaseTokenV2', meta.eth.rebaseTokenV2, [
        meta.eth.supplyManagerV2,
        account.address,
        config.META_TOKEN_NAME,
        config.META_TOKEN_SYMBOL,
        config.META_TOKEN_DECIMALS,
        meta.eth.supplyManagerV2,
    ]);

    for (const vault of [meta.eth.stETHVault, meta.eth.wETHVault]) {
        await verifyContract(hre, 'MetaERC20TokenVault', vault, [
            account.address,
            meta.eth.rebaseTokenV2,
            meta.eth.supplyManagerV2,
            config.META_GUARDIAN,
        ]);
    }

    await verifyContract(hre, 'MetaNativeTokenVault', meta.eth.nativeTokenVault, [
        account.address,
        meta.eth.rebaseTokenV2,
        meta.eth.supplyManagerV2,
        config.META_GUARDIAN,
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
