/* eslint-disable no-restricted-syntax, no-await-in-loop */

import { type HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { keccak256 } from 'ethers';
import { type HardhatRuntimeEnvironment } from 'hardhat/types';

import {
    type EVMChainIDs,
    renzoContractAddresses,
    rsETHAddresses,
} from '@molecula-monorepo/blockchain.addresses';

import {
    DEPLOY_GAS_LIMIT,
    ETH_VIRTUAL_OFFSET,
    type MetaEthNetworkConfig,
    NATIVE_TOKEN,
} from '../../configs';

import { getFeeds } from './utils';

/**
 * Main deployment function for the metaETH system.
 * Deploys all necessary contracts and initializes them with the correct configuration.
 */
export async function deployAndInitMetaEth(
    hre: HardhatRuntimeEnvironment,
    config: MetaEthNetworkConfig,
    account: HardhatEthersSigner,
    chainId: EVMChainIDs,
    withPoolTokens: boolean,
) {
    // print wallet balances
    console.log('Wallet address: ', account.address);
    console.log(
        'ETH balance: ',
        hre.ethers.formatEther(await hre.ethers.provider.getBalance(account.address)),
    );

    console.log('Deploying priceChecker...');
    const PriceChecker = await hre.ethers.getContractFactory('PriceChecker');

    const feeds = getFeeds(hre, config, chainId, withPoolTokens);
    const priceChecker = await PriceChecker.deploy(
        feeds,
        config.OWNER,
        config.META_ETH_TOKEN_DECIMALS,
        { gasLimit: DEPLOY_GAS_LIMIT },
    );
    await priceChecker.waitForDeployment();
    console.log('PriceChecker address:', await priceChecker.getAddress());

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
        config.OWNER,
        config.POOL_KEEPER,
        supplyManagerFutureAddress,
        [],
        config.GUARDIAN,
        await priceChecker.getAddress(),
        { gasLimit: DEPLOY_GAS_LIMIT },
    );
    await metaPoolTreasury.waitForDeployment();
    console.log('MetaPoolTreasury address:', await metaPoolTreasury.getAddress());

    console.log('Deploying SupplyManagerV2...');
    const SupplyManagerV2 = await hre.ethers.getContractFactory('SupplyManagerV2WithNative');
    const supplyManagerV2 = await SupplyManagerV2.deploy(
        config.OWNER,
        config.YIELD_DISTRIBUTOR,
        metaPoolTreasury,
        config.APY,
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
        config.META_ETH_TOKEN_NAME,
        config.META_ETH_TOKEN_SYMBOL,
        config.META_ETH_TOKEN_DECIMALS,
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
        config.GUARDIAN,
        { gasLimit: DEPLOY_GAS_LIMIT },
    );
    await stETHVault.waitForDeployment();
    console.log('stETHVault address:', await stETHVault.getAddress());

    console.log('Deploying wETHVault...');
    const wETHVault = await MetaERC20TokenVault.deploy(
        account.address,
        rebaseTokenV2,
        supplyManagerV2,
        config.GUARDIAN,
        { gasLimit: DEPLOY_GAS_LIMIT },
    );
    await wETHVault.waitForDeployment();
    console.log('wETHVault address:', await wETHVault.getAddress());

    let weETHVault;
    let rsETHVault;
    let ezETHVault;
    if (withPoolTokens) {
        console.log('Deploying weETHVault...');
        const WeETHTokenVault = await hre.ethers.getContractFactory('WeETHTokenVault');
        weETHVault = await WeETHTokenVault.deploy(
            account.address,
            rebaseTokenV2,
            supplyManagerV2,
            config.GUARDIAN,
            { gasLimit: DEPLOY_GAS_LIMIT },
        );
        await weETHVault.waitForDeployment();
        console.log('weETHVault address:', await wETHVault.getAddress());

        console.log('Deploying rsETHVault...');
        const RsETHTokenVault = await hre.ethers.getContractFactory('RsETHTokenVault');
        rsETHVault = await RsETHTokenVault.deploy(
            account.address,
            rebaseTokenV2,
            supplyManagerV2,
            config.GUARDIAN,
            rsETHAddresses.LRTOracle,
            { gasLimit: DEPLOY_GAS_LIMIT },
        );
        await rsETHVault.waitForDeployment();
        console.log('rsETHVault address:', await rsETHVault.getAddress());

        console.log('Deploying ezETHVault...');
        const EzETHTokenVault = await hre.ethers.getContractFactory('EzETHTokenVault');
        ezETHVault = await EzETHTokenVault.deploy(
            account.address,
            rebaseTokenV2,
            supplyManagerV2,
            config.GUARDIAN,
            renzoContractAddresses.restakeManager,
            { gasLimit: DEPLOY_GAS_LIMIT },
        );
        await ezETHVault.waitForDeployment();
        console.log('ezETHVault address:', await ezETHVault.getAddress());
    }

    console.log('Deploying NativeTokenVault...');
    const NativeTokenVault = await hre.ethers.getContractFactory('MetaNativeTokenVault');
    const nativeTokenVault = await NativeTokenVault.deploy(
        account.address,
        rebaseTokenV2,
        supplyManagerV2,
        config.GUARDIAN,
        { gasLimit: DEPLOY_GAS_LIMIT },
    );
    await nativeTokenVault.waitForDeployment();
    console.log('NativeTokenVault address:', await nativeTokenVault.getAddress());

    console.log('Deploying wmetaETH...');
    const RewardBearingWrapper = await hre.ethers.getContractFactory('RewardBearingWrapper');
    const wmetaETH = await RewardBearingWrapper.deploy(
        config.WMETA_ETH_TOKEN_NAME,
        config.WMETA_ETH_TOKEN_SYMBOL,
        rebaseTokenV2,
        { gasLimit: DEPLOY_GAS_LIMIT },
    );
    await wmetaETH.waitForDeployment();
    console.log('wmetaETH address:', await wmetaETH.getAddress());

    console.log('Adding code hashes into rebaseTokenV2...');
    const codeHashes = [
        keccak256((await wETHVault.getDeployedCode())!),
        keccak256((await nativeTokenVault.getDeployedCode())!),
    ];
    if (withPoolTokens) {
        codeHashes.push(
            keccak256((await weETHVault!.getDeployedCode())!),
            keccak256((await rsETHVault!.getDeployedCode())!),
            keccak256((await ezETHVault!.getDeployedCode())!),
        );
    }
    for (const codeHash of codeHashes) {
        const tx = await rebaseTokenV2.setCodeHash(codeHash, true);
        await tx.wait();
    }
    console.log('Code hashes are added');

    const initData = [
        { vault: stETHVault, token: config.stETH, minDeposit: config.MIN_DEPOSIT_ETH },
        { vault: wETHVault, token: config.wETH, minDeposit: config.MIN_DEPOSIT_ETH },
        { vault: nativeTokenVault, token: NATIVE_TOKEN, minDeposit: config.MIN_DEPOSIT_ETH },
    ];
    if (withPoolTokens) {
        initData.push(
            { vault: weETHVault!, token: config.weETH, minDeposit: config.MIN_DEPOSIT_weETH },
            { vault: rsETHVault!, token: config.rsETH, minDeposit: config.MIN_DEPOSIT_rsETH },
            { vault: ezETHVault!, token: config.ezETH, minDeposit: config.MIN_DEPOSIT_ezETH },
        );
    }
    for (const { vault, token, minDeposit } of initData) {
        console.log(`Initializing vault: ${await vault.getAddress()} ...`);
        let tx = await vault.init(token, minDeposit, config.MIN_REDEEM_SHARES);
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

    const ownableContracts = [
        await rebaseTokenV2.getAddress(),
        await wETHVault.getAddress(),
        await stETHVault.getAddress(),
        await nativeTokenVault.getAddress(),
    ];
    if (withPoolTokens) {
        ownableContracts.push(
            await weETHVault!.getAddress(),
            await rsETHVault!.getAddress(),
            await ezETHVault!.getAddress(),
        );
    }
    for (const addr of ownableContracts) {
        console.log(`Changing owner for ${addr}`);
        const ownable2Step = await hre.ethers.getContractAt('Ownable2Step', addr);
        const tx = await ownable2Step.transferOwnership(config.OWNER);
        await tx.wait();
        // Note: META_OWNER must call `acceptOwnership` function
    }

    return {
        metaPoolTreasury: await metaPoolTreasury.getAddress(),
        supplyManagerV2: await supplyManagerV2.getAddress(),
        metaETH: await rebaseTokenV2.getAddress(),
        wmetaETH: await wmetaETH.getAddress(),
        stETHVault: await stETHVault.getAddress(),
        wETHVault: await wETHVault.getAddress(),
        nativeTokenVault: await nativeTokenVault.getAddress(),
        weETHVault: weETHVault === undefined ? '' : await weETHVault!.getAddress(),
        rsETHVault: rsETHVault === undefined ? '' : await rsETHVault!.getAddress(),
        ezETHVault: ezETHVault === undefined ? '' : await ezETHVault!.getAddress(),
        priceChecker: await priceChecker.getAddress(),
    };
}
