/* eslint-disable no-restricted-syntax, no-await-in-loop */

import { keccak256 } from 'ethers';
import { type HardhatRuntimeEnvironment } from 'hardhat/types';

import type { EnvironmentType } from '@molecula-monorepo/blockchain.addresses';

import { DEPLOY_GAS_LIMIT, ETH_VIRTUAL_OFFSET, NATIVE_TOKEN } from '../../../configs/ethereum';
import { getConfig } from '../../utils/deployUtils';

/**
 * Main deployment function for the mrETH system.
 * Deploys all necessary contracts and initializes them with the correct configuration.
 */
export async function deployMetaEth(hre: HardhatRuntimeEnvironment, environment: EnvironmentType) {
    const { config, account } = await getConfig(hre, environment);

    // Calculate future contract addresses for proper initialization
    const transactionCount = await account.getNonce();
    const supplyManagerFutureAddress = hre.ethers.getCreateAddress({
        from: account.address,
        nonce: transactionCount + 1,
    });
    const rebaseTokenFutureAddress = hre.ethers.getCreateAddress({
        from: account.address,
        nonce: transactionCount + 2,
    });

    console.log('Deploying MetaPoolTreasury...');
    const MetaPoolTreasury = await hre.ethers.getContractFactory('MetaPoolTreasury');
    const metaPoolTreasury = await MetaPoolTreasury.deploy(
        config.META_OWNER,
        config.META_POOL_KEEPER,
        supplyManagerFutureAddress,
        [],
        config.META_GUARDIAN,
        hre.ethers.ZeroAddress,
        { gasLimit: DEPLOY_GAS_LIMIT },
    );
    await metaPoolTreasury.waitForDeployment();
    console.log('MetaPoolTreasury address:', await metaPoolTreasury.getAddress());

    console.log('Deploying SupplyManagerV2...');
    const SupplyManagerV2 = await hre.ethers.getContractFactory('SupplyManagerV2WithNative');
    const supplyManagerV2 = await SupplyManagerV2.deploy(
        config.META_OWNER,
        config.META_POOL_KEEPER,
        metaPoolTreasury,
        config.META_APY,
        rebaseTokenFutureAddress,
        ETH_VIRTUAL_OFFSET,
        { gasLimit: DEPLOY_GAS_LIMIT },
    );
    await supplyManagerV2.waitForDeployment();
    console.log('SupplyManagerV2 address:', await supplyManagerV2.getAddress());
    if ((await supplyManagerV2.getAddress()) !== supplyManagerFutureAddress) {
        throw new Error(`SupplyManagerV2 address is not correct: ${supplyManagerFutureAddress}`);
    }

    console.log('Deploying RebaseTokenV2...');
    const RebaseTokenV2 = await hre.ethers.getContractFactory('RebaseTokenV2');
    const rebaseTokenV2 = await RebaseTokenV2.deploy(
        supplyManagerV2,
        account.address,
        config.META_TOKEN_NAME,
        config.META_TOKEN_SYMBOL,
        config.META_TOKEN_DECIMALS,
        supplyManagerV2,
        { gasLimit: DEPLOY_GAS_LIMIT },
    );
    await rebaseTokenV2.waitForDeployment();
    console.log('RebaseTokenV2 address:', await rebaseTokenV2.getAddress());
    if ((await rebaseTokenV2.getAddress()) !== rebaseTokenFutureAddress) {
        throw new Error(`RebaseTokenV2 address is not correct: ${rebaseTokenFutureAddress}`);
    }

    console.log('Deploying stETHVault...');
    const MetaERC20TokenVault = await hre.ethers.getContractFactory('MetaERC20TokenVault');
    const stETHVault = await MetaERC20TokenVault.deploy(
        account.address,
        rebaseTokenV2,
        supplyManagerV2,
        config.META_GUARDIAN,
        { gasLimit: DEPLOY_GAS_LIMIT },
    );
    await stETHVault.waitForDeployment();
    console.log('stETHVault address:', await stETHVault.getAddress());

    console.log('Deploying wETHVault...');
    const wETHVault = await MetaERC20TokenVault.deploy(
        account.address,
        rebaseTokenV2,
        supplyManagerV2,
        config.META_GUARDIAN,
        { gasLimit: DEPLOY_GAS_LIMIT },
    );
    await wETHVault.waitForDeployment();
    console.log('wETHVault address:', await wETHVault.getAddress());

    console.log('Deploying NativeTokenVault...');
    const NativeTokenVault = await hre.ethers.getContractFactory('MetaNativeTokenVault');
    const nativeTokenVault = await NativeTokenVault.deploy(
        account.address,
        rebaseTokenV2,
        supplyManagerV2,
        config.META_GUARDIAN,
        { gasLimit: DEPLOY_GAS_LIMIT },
    );
    await nativeTokenVault.waitForDeployment();
    console.log('NativeTokenVault address:', await nativeTokenVault.getAddress());

    console.log('Adding code hashes into rebaseTokenV2...');
    for (const codeHash of [
        keccak256((await wETHVault.getDeployedCode())!),
        keccak256((await nativeTokenVault.getDeployedCode())!),
    ]) {
        const tx = await rebaseTokenV2.setCodeHash(codeHash, true);
        await tx.wait();
    }
    console.log('Code hashes are added');

    for (const { vault, token } of [
        { vault: stETHVault, token: config.STETH_ADDRESS },
        { vault: wETHVault, token: config.WETH_ADDRESS },
        { vault: nativeTokenVault, token: NATIVE_TOKEN },
    ]) {
        console.log(`Initializing vault: ${await vault.getAddress()} ...`);
        let tx = await vault.init(
            token,
            config.META_MIN_DEPOSIT_ETH,
            config.META_MIN_REDEEM_SHARES,
        );
        await tx.wait();

        console.log('   Adding vault into rebaseTokenV2...');
        tx = await rebaseTokenV2.addTokenVault(vault);
        await tx.wait();

        console.log('   Unpause Deposit and Redeem for vault..');
        // TODO change it for production
        tx = await vault.unpauseAll();
        await tx.wait();

        console.log('Vault is set');
    }

    for (const addr of [
        await rebaseTokenV2.getAddress(),
        await wETHVault.getAddress(),
        await stETHVault.getAddress(),
        await nativeTokenVault.getAddress(),
    ]) {
        console.log(`Change owner for ${addr}`);
        const ownable2Step = await hre.ethers.getContractAt('Ownable2Step', addr);
        const tx = await ownable2Step.transferOwnership(config.META_OWNER);
        await tx.wait();
        // Note: META_OWNER must call `acceptOwnership` function
    }

    return {
        metaPoolTreasury: await metaPoolTreasury.getAddress(),
        supplyManagerV2: await supplyManagerV2.getAddress(),
        rebaseTokenV2: await rebaseTokenV2.getAddress(),
        stETHVault: await stETHVault.getAddress(),
        wETHVault: await wETHVault.getAddress(),
        nativeTokenVault: await nativeTokenVault.getAddress(),
    };
}
