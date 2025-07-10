/* eslint-disable camelcase, max-lines, no-await-in-loop, no-restricted-syntax, no-bitwise, no-plusplus */
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';

import { ethers } from 'ethers';

import { deployCoreV2 } from '../../utils/CoreV2';
import { findRequestRedeemEventV2 } from '../../utils/event';
import { grantERC20 } from '../../utils/grant';
import { expectEqual } from '../../utils/math';

describe('Core V2', () => {
    it('Tets gas usage for fulfillRedeemRequests', async () => {
        const { user0, usdcVault, rebaseTokenV2, USDC, metaPoolTreasury } =
            await loadFixture(deployCoreV2);

        const decimals: bigint = await USDC.decimals();
        const depositValue = 1_000_000n * 10n ** decimals;

        // Grand USD and approve tokens for usdcVault
        await grantERC20(user0, USDC, depositValue);
        await USDC.connect(user0).approve(usdcVault, depositValue);

        // Deposit assets in every way
        await usdcVault.connect(user0).requestDeposit(depositValue, user0, user0);
        const userShares = await rebaseTokenV2.sharesOf(user0);

        // requestRedeem
        const requestAmount = 2; // increase if it needs
        const requestIDs = [];
        for (let i = 0; i < requestAmount; i += 1) {
            const tx = await usdcVault
                .connect(user0)
                .requestRedeem(userShares / BigInt(requestAmount), user0, user0);
            const redeemEvent = await findRequestRedeemEventV2(tx);
            requestIDs.push(redeemEvent.operationId);
        }

        // fulfillRedeemRequests
        await metaPoolTreasury.fulfillRedeemRequests(requestIDs);
    });

    it('Should deposit and redeem', async () => {
        const { user0, usdcVault, rebaseTokenV2, USDC, metaPoolTreasury, supplyManagerV2 } =
            await loadFixture(deployCoreV2);

        const decimals: bigint = await USDC.decimals();
        const depositValue = 100n * 10n ** decimals;

        // Grand USD and approve tokens for usdcVault
        await grantERC20(user0, USDC, 4n * depositValue);
        await USDC.connect(user0).approve(usdcVault, 4n * depositValue);

        // Check shares
        const shares = await usdcVault.convertToShares(depositValue);
        const shares2 = await supplyManagerV2.convertToShares(depositValue * 10n ** 12n);
        expect(shares).to.be.equal(shares2);

        // Deposit assets in every way
        expect(await usdcVault.previewDeposit(depositValue)).to.be.equal(shares);
        await usdcVault.connect(user0).requestDeposit(depositValue, user0, user0);
        expect(await rebaseTokenV2.sharesOf(user0)).to.be.equal(shares);

        await usdcVault.connect(user0)['deposit(uint256,address)'](depositValue, user0);
        expect(await rebaseTokenV2.sharesOf(user0)).to.be.equal(2n * shares);

        expectEqual(await usdcVault.previewMint(shares), depositValue);
        await usdcVault.connect(user0)['mint(uint256,address,address)'](shares, user0, user0);
        expectEqual(await rebaseTokenV2.sharesOf(user0), 3n * shares, 18, 14);

        await usdcVault.connect(user0)['mint(uint256,address)'](shares, user0);
        expectEqual(await rebaseTokenV2.sharesOf(user0), 4n * shares, 18, 14);

        // Generate yield
        await grantERC20(metaPoolTreasury, USDC, 10n * depositValue - 1n);

        // requestRedeem
        const userShares = await rebaseTokenV2.sharesOf(user0);
        const redeemAssets = await usdcVault.convertToAssets(userShares);
        expect(await usdcVault.maxWithdraw(user0)).to.be.equal(redeemAssets);
        const tx = await usdcVault.connect(user0).requestRedeem(userShares - 1n, user0, user0);
        expectEqual(await usdcVault.pendingRedeemRequest(0, user0), userShares);
        const redeemEvent = await findRequestRedeemEventV2(tx);

        // fulfillRedeemRequests
        await metaPoolTreasury.fulfillRedeemRequests([redeemEvent.operationId]);
        expectEqual(await usdcVault.claimableRedeemRequest(0, user0), userShares, 18, 6);
        expect(await usdcVault.claimableRedeemAssets(user0)).to.be.equal(redeemAssets);

        // redeem
        expect(await USDC.balanceOf(user0)).to.be.equal(0);
        await usdcVault.connect(user0).redeem(userShares, user0, user0);
        expect(await USDC.balanceOf(user0)).to.be.equal(redeemAssets);
    });

    it('Should deposit and redeem #2', async () => {
        const { user0, usdcVault, rebaseTokenV2, USDC, metaPoolTreasury } =
            await loadFixture(deployCoreV2);

        const decimals: bigint = await USDC.decimals();
        const depositValue = 100n * 10n ** decimals;

        // Grand USD and approve tokens for usdcVault
        await grantERC20(user0, USDC, depositValue);
        await USDC.connect(user0).approve(usdcVault, depositValue);

        // Deposit assets in every way
        await usdcVault.connect(user0).requestDeposit(depositValue, user0, user0);

        // Generate yield
        await grantERC20(metaPoolTreasury, USDC, 10n * depositValue - 1n);

        // requestRedeem depositValue
        const tx = await usdcVault.connect(user0).requestWithdraw(depositValue, user0, user0);
        const redeemEvent = await findRequestRedeemEventV2(tx);

        // fulfillRedeemRequests
        expectEqual(await usdcVault.claimableRedeemAssets(user0), 0n);
        await metaPoolTreasury.fulfillRedeemRequests([redeemEvent.operationId]);
        expectEqual(await usdcVault.claimableRedeemAssets(user0), depositValue, 6, 5);

        // withdraw
        expect(await USDC.balanceOf(user0)).to.be.equal(0);
        await usdcVault.connect(user0).withdraw(depositValue - 1n, user0, user0);
        expectEqual(await USDC.balanceOf(user0), depositValue);
        expect(await rebaseTokenV2.balanceOf(user0)).to.be.greaterThan(0);
    });

    it('Should deposit as operator', async () => {
        const { user0, usdcVault, rebaseTokenV2, USDC, operator, user1, metaPoolTreasury } =
            await loadFixture(deployCoreV2);

        const decimals: bigint = await USDC.decimals();
        const depositValue = 100n * 10n ** decimals;

        // Grand USD and approve tokens for usdcVault
        await grantERC20(user0, USDC, 2n * depositValue);
        await USDC.connect(user0).approve(usdcVault, 2n * depositValue);

        // user0 sets operator and deposit tokens two times
        await usdcVault.connect(user0).setOperator(operator, true);
        await usdcVault
            .connect(operator)
            ['deposit(uint256,address,address)'](depositValue, user1, user0);
        await usdcVault
            .connect(user0)
            ['deposit(uint256,address,address)'](depositValue, user1, user0);

        const shares = 100n * 10n ** 18n;
        expect(await rebaseTokenV2.balanceOf(user1)).to.be.equal(2n * shares);

        // user1 request redeem
        expect(await USDC.balanceOf(user1)).to.be.equal(0);

        const tx = await usdcVault.connect(user1).requestRedeem(shares, user1, user1);
        const requestId = (await findRequestRedeemEventV2(tx)).operationId;
        await metaPoolTreasury.fulfillRedeemRequests([requestId]);
        const claimableAssets = await usdcVault.claimableRedeemAssets(user1);
        expect(claimableAssets).to.be.greaterThan(0);
        await usdcVault.connect(user1).withdraw(claimableAssets, user1, user1);

        // expect(await moleculaRebaseToken.balanceOf(user1)).to.be.equal(shares);
        expect(await USDC.balanceOf(user1)).to.be.equal(depositValue);
    });

    it('Test getters / errors', async () => {
        const { user0, user1, usdcVault, rebaseTokenV2 } = await loadFixture(deployCoreV2);

        expect(await usdcVault.share()).to.be.equal(rebaseTokenV2);
        expect(await usdcVault.pendingDepositRequest(0, ethers.ZeroAddress)).to.be.equal(0);
        expect(await usdcVault.claimableDepositRequest(0, ethers.ZeroAddress)).to.be.equal(0);
        expect(await usdcVault.pendingRedeemRequest(1, ethers.ZeroAddress)).to.be.equal(0);
        expect(await usdcVault.claimableRedeemRequest(1, ethers.ZeroAddress)).to.be.equal(0);

        expect(await usdcVault.maxDeposit(ethers.ZeroAddress)).to.be.equal(ethers.MaxUint256);
        expect(await usdcVault.maxMint(ethers.ZeroAddress)).to.be.equal(ethers.MaxUint256);

        await expect(usdcVault.previewRedeem(0)).to.be.rejectedWith('EAsyncRedeem');
        await expect(usdcVault.previewWithdraw(0)).to.be.rejectedWith('EAsyncRedeem');

        await expect(usdcVault.connect(user0).withdraw(0, user1, user1)).to.be.rejectedWith(
            'EInvalidOperator',
        );
        await expect(usdcVault.connect(user0).withdraw(1, user0, user0)).to.be.rejectedWith(
            'ETooManyRedeemAssets',
        );
        await expect(usdcVault.connect(user0).setOperator(user0, true)).to.be.rejectedWith(
            'ESelfOperator',
        );
    });
});
