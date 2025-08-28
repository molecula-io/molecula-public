/* eslint-disable camelcase, max-lines */
import { days } from '@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time/duration';
import { expect } from 'chai';
import { keccak256, type Signer } from 'ethers';
import { ethers } from 'hardhat';

import { ethMainnetBetaConfig } from '../../configs';

import type { IERC20, MoleculaPoolTreasuryV2 } from '../../typechain-types';

import { generateRandomWallet } from './Common';
import { findRequestRedeemEvent } from './event';
import { grantERC20 } from './grant';

export async function deployNitrogenV2CommonWithOldMoleculaPool(token: string) {
    // Contracts are deployed using the first signer/account by default
    const signers = await ethers.getSigners();
    const poolKeeper = await generateRandomWallet();
    const poolOwner = signers.at(0)!;
    const rebaseTokenOwner = signers.at(1)!;
    const user0 = await generateRandomWallet();
    const user1 = await generateRandomWallet();
    const caller = signers.at(4)!;
    const malicious = signers.at(5)!;
    const controller = signers.at(6)!;
    const randAccount = signers.at(7)!;
    const guardian = signers.at(8)!;
    const yieldDistributor = signers.at(9)!;
    const lmUSDHolder = signers.at(10)!;
    const user2 = signers.at(11)!;

    // calc future addresses
    const transactionCount = await poolOwner.getNonce();
    const addr = poolOwner.address;
    const supplyManagerFutureAddress = ethers.getCreateAddress({
        from: addr,
        nonce: transactionCount + 2,
    });
    const rebaseTokenFutureAddress = ethers.getCreateAddress({
        from: addr,
        nonce: transactionCount + 3,
    });

    const USDT = await ethers.getContractAt('IERC20', ethMainnetBetaConfig.USDT_ADDRESS);
    const approveSelector = USDT.interface.getFunction('approve').selector;

    // deploy moleculaPool
    const MoleculaPool = await ethers.getContractFactory('MoleculaPoolTreasury');
    const moleculaPool = await MoleculaPool.connect(poolOwner).deploy(
        poolOwner.address,
        ethMainnetBetaConfig.MOLECULA_POOL_TOKENS.map(x => x.token),
        poolKeeper,
        supplyManagerFutureAddress,
        [],
        guardian,
    );

    // if moleculaPool does not have DAI then transfer them
    const DAI = await ethers.getContractAt('IERC20', ethMainnetBetaConfig.DAI_ADDRESS);
    const initBalance = await DAI.balanceOf(moleculaPool.getAddress());
    expect(initBalance).to.be.equal(0n);
    // grant DAI for initial supply
    const INITIAL_SUPPLY = 100n * 10n ** 18n;
    await grantERC20(moleculaPool.getAddress(), DAI, INITIAL_SUPPLY);
    expect(await DAI.balanceOf(moleculaPool.getAddress())).to.equal(INITIAL_SUPPLY);

    // deploy pausable agent accountant
    const Agent = await ethers.getContractFactory('AccountantAgent');
    const agent = await Agent.connect(poolOwner).deploy(
        poolOwner.address,
        rebaseTokenFutureAddress,
        supplyManagerFutureAddress,
        token,
        guardian,
    );

    // deploy supply manager
    const SupplyManager = await ethers.getContractFactory('SupplyManager');
    const supplyManager = await SupplyManager.connect(poolOwner).deploy(
        poolOwner.address,
        poolOwner.address,
        await moleculaPool.getAddress(),
        4000,
    );

    expect(await supplyManager.getAddress()).to.equal(supplyManagerFutureAddress);

    // deploy Rebase Token
    const RebaseToken = await ethers.getContractFactory('RebaseToken');
    const rebaseToken = await RebaseToken.connect(poolOwner).deploy(
        rebaseTokenOwner.address,
        await agent.getAddress(),
        await supplyManager.totalSharesSupply(),
        await supplyManager.getAddress(),
        'ETH TEST molecula',
        'MTE',
        ethMainnetBetaConfig.MUSD_TOKEN_DECIMALS,
        10_000_000,
        10n * 10n ** 18n,
    );
    expect(await rebaseToken.getAddress()).to.equal(rebaseTokenFutureAddress);

    // set agent
    await supplyManager.setAgent(await agent.getAddress(), true);

    // verify force approve for Token correct work to increase allowance
    const Token = await ethers.getContractAt('IERC20', token);
    expect(await Token.allowance(moleculaPool, agent)).to.be.equal(ethers.MaxUint256);

    // verify force approve for Token correct work to decrease allowance
    await supplyManager.connect(poolOwner).setAgent(agent, false);
    expect(await Token.allowance(moleculaPool, agent)).to.be.equal(0n);

    await supplyManager.connect(poolOwner).setAgent(agent, true);
    expect(await Token.allowance(moleculaPool, agent)).to.be.equal(ethers.MaxUint256);

    // Deploy wmUSD
    const lmusdFutureAddress = ethers.getCreateAddress({
        from: poolOwner.address,
        nonce: (await poolOwner.getNonce()) + 1,
    });
    const WMUSD = await ethers.getContractFactory('MoleculaSuppliedWrapper');
    const wmusd = await WMUSD.deploy(
        ethMainnetBetaConfig.WMUSD_TOKEN_NAME,
        ethMainnetBetaConfig.WMUSD_TOKEN_SYMBOL,
        poolOwner,
        rebaseToken,
        lmusdFutureAddress,
    );

    // Deploy lmUSD
    const LMUSD = await ethers.getContractFactory('LMUSD');
    const lmusd = await LMUSD.deploy(
        ethMainnetBetaConfig.WMUSD_TOKEN_NAME,
        ethMainnetBetaConfig.WMUSD_TOKEN_SYMBOL,
        poolOwner,
        rebaseToken,
        wmusd,
        [days(7)],
        [1],
    );
    expect(await lmusd.getAddress()).to.be.equal(lmusdFutureAddress);

    return {
        moleculaPool,
        agent,
        supplyManager,
        rebaseToken,
        wmusd,
        poolOwner,
        rebaseTokenOwner,
        user0,
        user1,
        caller,
        malicious,
        controller,
        randAccount,
        guardian,
        yieldDistributor,
        USDT,
        approveSelector,
        lmUSDHolder,
        user2,
        poolKeeper,
        lmusd,
        DAI,
    };
}

export async function deployNitrogenV2Common(token: string) {
    // Contracts are deployed using the first signer/account by default
    const signers = await ethers.getSigners();
    const poolKeeper = await generateRandomWallet();
    const poolOwner = signers.at(0)!;
    const rebaseTokenOwner = signers.at(1)!;
    const user0 = await generateRandomWallet();
    const user1 = await generateRandomWallet();
    const caller = signers.at(4)!;
    const malicious = signers.at(5)!;
    const controller = signers.at(6)!;
    const randAccount = signers.at(7)!;
    const guardian = signers.at(8)!;
    const yieldDistributor = signers.at(9)!;
    const lmUSDHolder = signers.at(10)!;
    const user2 = signers.at(11)!;

    // calc future addresses
    const transactionCount = await poolOwner.getNonce();
    const addr = poolOwner.address;
    const supplyManagerFutureAddress = ethers.getCreateAddress({
        from: addr,
        nonce: transactionCount + 2,
    });
    const rebaseTokenFutureAddress = ethers.getCreateAddress({
        from: addr,
        nonce: transactionCount + 3,
    });

    const USDT = await ethers.getContractAt('IERC20', ethMainnetBetaConfig.USDT_ADDRESS);
    const approveSelector = USDT.interface.getFunction('approve').selector;

    // deploy moleculaPool
    const MoleculaPool = await ethers.getContractFactory('MoleculaPoolTreasuryV2');
    const moleculaPool = await MoleculaPool.connect(poolOwner).deploy(
        poolOwner.address,
        ethMainnetBetaConfig.MOLECULA_POOL_TOKENS.map(x => x.token),
        poolKeeper,
        supplyManagerFutureAddress,
        [{ target: USDT, selector: approveSelector }],
        guardian,
        ethers.ZeroAddress,
    );

    // if moleculaPool does not have DAI then transfer them
    const DAI = await ethers.getContractAt('IERC20', ethMainnetBetaConfig.DAI_ADDRESS);
    const initBalance = await DAI.balanceOf(moleculaPool.getAddress());
    expect(initBalance).to.be.equal(0n);
    // grant DAI for initial supply
    const INITIAL_SUPPLY = 100n * 10n ** 18n;
    await grantERC20(moleculaPool.getAddress(), DAI, INITIAL_SUPPLY);
    expect(await DAI.balanceOf(moleculaPool.getAddress())).to.equal(INITIAL_SUPPLY);

    // deploy pausable agent accountant
    const Agent = await ethers.getContractFactory('AccountantAgent');
    const agent = await Agent.connect(poolOwner).deploy(
        poolOwner.address,
        rebaseTokenFutureAddress,
        supplyManagerFutureAddress,
        token,
        guardian,
    );

    // deploy supply manager
    const SupplyManager = await ethers.getContractFactory('SupplyManager');
    const supplyManager = await SupplyManager.connect(poolOwner).deploy(
        poolOwner.address,
        poolOwner.address,
        await moleculaPool.getAddress(),
        4000,
    );

    expect(await supplyManager.getAddress()).to.equal(supplyManagerFutureAddress);

    // deploy Rebase Token
    const RebaseToken = await ethers.getContractFactory('RebaseToken');
    const rebaseToken = await RebaseToken.connect(poolOwner).deploy(
        rebaseTokenOwner.address,
        await agent.getAddress(),
        await supplyManager.totalSharesSupply(),
        await supplyManager.getAddress(),
        'ETH TEST molecula',
        'MTE',
        ethMainnetBetaConfig.MUSD_TOKEN_DECIMALS,
        10_000_000,
        10n * 10n ** 18n,
    );
    expect(await rebaseToken.getAddress()).to.equal(rebaseTokenFutureAddress);

    // set agent
    await supplyManager.setAgent(await agent.getAddress(), true);

    // verify force approve for Token correct work to increase allowance
    const Token = await ethers.getContractAt('IERC20', token);
    expect(await Token.allowance(moleculaPool, agent)).to.be.equal(ethers.MaxUint256);

    // verify force approve for Token correct work to decrease allowance
    await supplyManager.connect(poolOwner).setAgent(agent, false);
    expect(await Token.allowance(moleculaPool, agent)).to.be.equal(0);

    await supplyManager.connect(poolOwner).setAgent(agent, true);
    expect(await Token.allowance(moleculaPool, agent)).to.be.equal(ethers.MaxUint256);

    // Deploy wmUSD
    const lmusdFutureAddress = ethers.getCreateAddress({
        from: poolOwner.address,
        nonce: (await poolOwner.getNonce()) + 1,
    });
    const WMUSD = await ethers.getContractFactory('MoleculaSuppliedWrapper');
    const wmusd = await WMUSD.deploy(
        ethMainnetBetaConfig.WMUSD_TOKEN_NAME,
        ethMainnetBetaConfig.WMUSD_TOKEN_SYMBOL,
        poolOwner,
        rebaseToken,
        lmusdFutureAddress,
    );

    // Deploy lmUSD
    const LMUSD = await ethers.getContractFactory('LMUSD');
    const lmusd = await LMUSD.deploy(
        ethMainnetBetaConfig.WMUSD_TOKEN_NAME,
        ethMainnetBetaConfig.WMUSD_TOKEN_SYMBOL,
        poolOwner,
        rebaseToken,
        wmusd,
        [days(7)],
        [1],
    );
    expect(await lmusd.getAddress()).to.be.equal(lmusdFutureAddress);

    return {
        moleculaPool,
        agent,
        supplyManager,
        rebaseToken,
        wmusd,
        poolOwner,
        rebaseTokenOwner,
        user0,
        user1,
        caller,
        malicious,
        controller,
        randAccount,
        guardian,
        yieldDistributor,
        USDT,
        approveSelector,
        lmUSDHolder,
        user2,
        poolKeeper,
        lmusd,
        DAI,
    };
}

export function deployNitrogenWithUSDT() {
    return deployNitrogenV2Common(ethMainnetBetaConfig.USDT_ADDRESS);
}

export function deployNitrogenWithUSDTAndOldPool() {
    return deployNitrogenV2CommonWithOldMoleculaPool(ethMainnetBetaConfig.USDT_ADDRESS);
}

export function deployNitrogenWithStakedUSDe() {
    return deployNitrogenV2Common(ethMainnetBetaConfig.SUSDE_ADDRESS);
}

export async function deployMoleculaPool() {
    const USDT = await ethers.getContractAt('IERC20', ethMainnetBetaConfig.USDT_ADDRESS);

    const signers = await ethers.getSigners();
    const poolOwner = signers.at(0)!;
    const poolKeeper = signers.at(1)!;
    const randomAccount = signers.at(2)!;
    const malicious = signers.at(3)!;
    const guardian = signers.at(4)!;
    const approveSelector = USDT.interface.getFunction('approve').selector;

    // deploy moleculaPool
    const MoleculaPool = await ethers.getContractFactory('MoleculaPoolTreasuryV2');
    const moleculaPool = await MoleculaPool.connect(poolOwner).deploy(
        poolOwner.address,
        [],
        poolKeeper.address,
        randomAccount.address,
        [{ target: ethMainnetBetaConfig.USDT_ADDRESS, selector: approveSelector }],
        guardian,
        ethers.ZeroAddress,
    );
    return { moleculaPool, poolOwner, poolKeeper, malicious, USDT, randomAccount, approveSelector };
}

export async function initNitrogenForPause() {
    const nitro = await deployNitrogenWithUSDT();
    const keeperSigner = await ethers.getImpersonatedSigner(await nitro.moleculaPool.poolKeeper());
    await nitro.moleculaPool.addInWhiteList(
        nitro.USDT,
        nitro.USDT.interface.getFunction('balanceOf').selector,
    );
    await nitro.moleculaPool.setSpenderInWhiteList(nitro.randAccount.address, true);

    // Prepare messages
    const encodedApprove = nitro.USDT.interface.encodeFunctionData('approve', [
        nitro.randAccount.address,
        100500n,
    ]);
    const encodedBalanceOf = nitro.USDT.interface.encodeFunctionData('balanceOf', [
        nitro.randAccount.address,
    ]);

    const failToExecuteFunctions = async (errorMsg: string) => {
        await expect(
            nitro.moleculaPool
                .connect(keeperSigner)
                .execute(nitro.USDT.getAddress(), encodedBalanceOf),
        ).to.be.rejectedWith(errorMsg);
        await expect(
            nitro.moleculaPool
                .connect(keeperSigner)
                .execute(nitro.USDT.getAddress(), encodedApprove),
        ).to.be.rejectedWith(errorMsg);
    };
    const executeFunctions = async () => {
        await nitro.moleculaPool
            .connect(keeperSigner)
            .execute(nitro.USDT.getAddress(), encodedBalanceOf);
        await nitro.moleculaPool
            .connect(keeperSigner)
            .execute(nitro.USDT.getAddress(), encodedApprove);
    };
    return {
        ...nitro,
        failToExecuteFunctions,
        executeFunctions,
    };
}

export async function initNitrogenAndRequestDeposit() {
    const { moleculaPool, rebaseToken, guardian, poolOwner, agent, user0, malicious, randAccount } =
        await deployNitrogenWithUSDT();
    const USDT = await ethers.getContractAt('IERC20', ethMainnetBetaConfig.USDT_ADDRESS);
    const depositValue = 100_000_000n;
    await grantERC20(user0, USDT, depositValue);
    // approve USDT to agent
    await USDT.connect(user0).approve(await agent.getAddress(), depositValue);
    // user0 calls requestDeposit on rebaseToken
    await rebaseToken.connect(user0).requestDeposit(depositValue, user0, user0);

    // user asks for redeem
    const redeemShares = await rebaseToken.sharesOf(user0);
    const tx = await rebaseToken.connect(user0).requestRedeem(redeemShares, user0, user0);
    const { operationId, redeemValue } = await findRequestRedeemEvent(tx);
    return {
        moleculaPool,
        guardian,
        user0,
        rebaseToken,
        malicious,
        poolOwner,
        USDT,
        randAccount,
        operationId,
        redeemValue,
    };
}

export async function deployNitrogenWithTokenVault() {
    const nitrogen = await deployNitrogenV2Common(ethMainnetBetaConfig.USDT_ADDRESS);
    const signers = await ethers.getSigners();
    const user2 = signers.at(10)!;
    const operator = signers.at(11)!;

    const USDC = await ethers.getContractAt('IERC20Metadata', ethMainnetBetaConfig.USDC_ADDRESS);
    const sUSDe = await ethers.getContractAt('IERC4626', ethMainnetBetaConfig.SUSDE_ADDRESS);
    const USDe = await ethers.getContractAt('IERC20Metadata', ethMainnetBetaConfig.USDE_ADDRESS);

    // deploy RebaseTokenOwner
    const RebaseTokenOwner = await ethers.getContractFactory('RebaseTokenOwner');
    const rebaseTokenOwner = await RebaseTokenOwner.connect(nitrogen.poolOwner).deploy(
        nitrogen.poolOwner,
        nitrogen.rebaseToken,
        nitrogen.guardian,
    );

    // deploy TokenVault
    const TokenVault = await ethers.getContractFactory('NitrogenTokenVault');
    const usdcVault = await TokenVault.connect(nitrogen.poolOwner).deploy(
        nitrogen.poolOwner,
        // Share. Note: it's not er20 token, but it should be! See https://eips.ethereum.org/EIPS/eip-7575
        nitrogen.rebaseToken,
        nitrogen.supplyManager,
        rebaseTokenOwner,
        nitrogen.guardian,
        ethers.ZeroAddress,
    );
    const susdeVault = await TokenVault.connect(nitrogen.poolOwner).deploy(
        nitrogen.poolOwner,
        // Share. Note: it's not er20 token, but it should be! See https://eips.ethereum.org/EIPS/eip-7575
        nitrogen.rebaseToken,
        nitrogen.supplyManager,
        rebaseTokenOwner,
        nitrogen.guardian,
        ethers.ZeroAddress,
    );

    // init usdcVault
    await usdcVault.init(
        USDC, // asset
        10n ** 6n, // minDepositValue
        10n ** 18n, // minRedeemShares
    );
    await susdeVault.init(
        sUSDe, // asset
        10n ** 6n, // minDepositValue
        10n ** 18n, // minRedeemShares
    );

    // Add usdcVault to supplyManager
    await nitrogen.supplyManager.connect(nitrogen.poolOwner).setAgent(usdcVault, true);
    await nitrogen.supplyManager.connect(nitrogen.poolOwner).setAgent(susdeVault, true);

    // Add usdcVault to RebaseTokenOwner
    const codeHash = keccak256((await usdcVault.getDeployedCode())!);
    await rebaseTokenOwner.setCodeHash(codeHash, true);
    await rebaseTokenOwner.addTokenVault(usdcVault.getAddress());
    await rebaseTokenOwner.addTokenVault(susdeVault.getAddress());

    // Set rebaseTokenOwner as owner of rebaseToken
    await nitrogen.rebaseToken
        .connect(nitrogen.rebaseTokenOwner)
        .transferOwnership(rebaseTokenOwner);

    await susdeVault.unpauseAll();
    await usdcVault.unpauseAll();

    return {
        ...nitrogen,
        usdcVault,
        susdeVault,
        rebaseTokenOwner,
        USDC,
        sUSDe,
        user2,
        operator,
        USDe,
    };
}

export async function getRidOf(
    moleculaPool: MoleculaPoolTreasuryV2,
    poolOwner: Signer,
    token: IERC20,
    receiver: string,
    poolKeeper: Signer,
) {
    // get rid of token from moleculaPool
    const { selector } = token.interface.getFunction('transfer');
    if (!(await moleculaPool.connect(poolOwner).isWhitelistedSignature(token, selector))) {
        await moleculaPool.connect(poolOwner).addInWhiteList(token, selector);
    }
    const encodedTransfer = token.interface.encodeFunctionData('transfer', [
        receiver,
        await token.balanceOf(moleculaPool),
    ]);
    await moleculaPool.connect(poolKeeper).execute(token, encodedTransfer);
}
