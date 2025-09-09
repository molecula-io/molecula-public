/* eslint-disable camelcase, max-lines, no-await-in-loop, no-restricted-syntax, no-bitwise, no-plusplus */
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';

import { ethers } from 'hardhat';

import { deployCoreV2WithRedeemController } from '../../utils/CoreV2';
import { findRequestRedeemEventV2 } from '../../utils/event';
import { grantERC20, grantETH } from '../../utils/grant';
import { expectEqual } from '../../utils/math';

describe('Redeem Controller for Core V2', () => {
    it('Should redeem ERC20 by controller', async () => {
        const { user0, user1, usdcVault, rebaseTokenV2, USDC, metaPoolTreasury, redeemController } =
            await loadFixture(deployCoreV2WithRedeemController);

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
        const tx = await usdcVault
            .connect(user0)
            .requestWithdraw(depositValue, redeemController, user0);
        const redeemEvent = await findRequestRedeemEventV2(tx);

        // fulfillRedeemRequests
        expectEqual(await usdcVault.claimableRedeemAssets(redeemController), 0n);
        await metaPoolTreasury.fulfillRedeemRequests([redeemEvent.operationId]);
        expectEqual(await usdcVault.claimableRedeemAssets(redeemController), depositValue, 6, 5);

        // withdraw assets by controller by any address
        expect(await USDC.balanceOf(user0)).to.be.equal(0);
        await redeemController.connect(user1).redeem([redeemEvent.operationId]);

        // receive assets by request owner
        expectEqual(await USDC.balanceOf(user0), depositValue);
        expect(await rebaseTokenV2.balanceOf(user0)).to.be.greaterThan(0);
    });

    it('Should redeem native token by controller', async () => {
        const {
            user0,
            user1,
            nativeTokenVault,
            rebaseTokenV2,
            metaPoolTreasury,
            supplyManagerV2,
            redeemController,
        } = await loadFixture(deployCoreV2WithRedeemController);

        const decimals: bigint = 18n;
        const depositValue = 100n * 10n ** decimals;

        // Check shares
        const shares = await nativeTokenVault.convertToShares(depositValue);
        const shares2 = await supplyManagerV2.convertToShares(depositValue);
        expect(shares).to.be.equal(shares2);

        // Deposit assets in every way
        expect(await nativeTokenVault.previewDeposit(depositValue)).to.be.equal(shares);
        await nativeTokenVault.connect(user0).deposit(depositValue, user0, { value: depositValue });
        expect(await rebaseTokenV2.sharesOf(user0)).to.be.equal(shares);

        expectEqual(await nativeTokenVault.previewMint(shares), depositValue);
        await nativeTokenVault.connect(user0).mint(shares, user0, { value: depositValue });
        expectEqual(await rebaseTokenV2.sharesOf(user0), 2n * shares);

        // Generate yield
        await grantETH(metaPoolTreasury, 10n * depositValue - 1n);

        // requestRedeem
        const userShares = await rebaseTokenV2.sharesOf(user0);
        const redeemAssets = await nativeTokenVault.convertToAssets(userShares);
        expect(await nativeTokenVault.maxWithdraw(user0)).to.be.equal(redeemAssets);
        let tx = await nativeTokenVault
            .connect(user0)
            .requestRedeem(userShares / 2n, redeemController, user0);
        const redeemEvent = await findRequestRedeemEventV2(tx);
        tx = await nativeTokenVault
            .connect(user0)
            .requestWithdraw(
                await nativeTokenVault.convertToAssets(userShares - userShares / 2n),
                redeemController,
                user0,
            );
        const redeemEvent2 = await findRequestRedeemEventV2(tx);
        expectEqual(await nativeTokenVault.pendingRedeemRequest(0, redeemController), userShares);

        // fulfillRedeemRequests
        await expect(
            metaPoolTreasury.fulfillRedeemRequests([redeemEvent.operationId]),
        ).to.be.rejectedWith('ENativeToken()');
        await metaPoolTreasury.fulfillRedeemRequestsForNativeToken([
            redeemEvent.operationId,
            redeemEvent2.operationId,
        ]);
        expectEqual(await nativeTokenVault.claimableRedeemRequest(0, redeemController), userShares);
        expectEqual(await nativeTokenVault.claimableRedeemAssets(redeemController), redeemAssets);

        // get available balance for reddem of user0
        const nativeBalance0 = await ethers.provider.getBalance(user0.address);
        const redeemValue = await nativeTokenVault.claimableRedeemAssets(redeemController);

        // redeem all assets by redeemEvent and redeemEvent2
        await redeemController
            .connect(user1)
            .redeem([redeemEvent.operationId, redeemEvent2.operationId]);

        // receive assets by request owner (user0)
        const nativeBalance1 = await ethers.provider.getBalance(user0.address);
        expectEqual(nativeBalance1 - nativeBalance0, redeemValue);
    });

    it('Should redeem multiple times by controller', async () => {
        const { user0, user1, usdcVault, rebaseTokenV2, USDC, metaPoolTreasury, redeemController } =
            await loadFixture(deployCoreV2WithRedeemController);

        const decimals: bigint = await USDC.decimals();
        const depositValue = 100n * 10n ** decimals;

        // ============ Generete claimable assets for user0 ============

        // Grand USD and approve tokens for usdcVault
        await grantERC20(user0, USDC, depositValue);
        await USDC.connect(user0).approve(usdcVault, depositValue);

        // Deposit assets in every way
        await usdcVault.connect(user0).requestDeposit(depositValue, user0, user0);

        // Generate yield
        await grantERC20(metaPoolTreasury, USDC, 10n * depositValue - 1n);

        // revert if requestId is not in the `Claimable` state
        await expect(redeemController.connect(user1).redeem([1n])).to.be.rejectedWith(
            'ERedeemRequestNotClaimable(',
        );

        // requestRedeem depositValue
        const tx = await usdcVault
            .connect(user0)
            .requestWithdraw(depositValue, redeemController, user0);
        const redeemEvent = await findRequestRedeemEventV2(tx);

        // fulfillRedeemRequests
        expectEqual(await usdcVault.claimableRedeemAssets(redeemController), 0n);
        // revert if requestId is not in the `Claimable` state
        await expect(
            redeemController.connect(user1).redeem([redeemEvent.operationId]),
        ).to.be.rejectedWith('ERedeemRequestNotClaimable(');

        await metaPoolTreasury.fulfillRedeemRequests([redeemEvent.operationId]);
        expectEqual(await usdcVault.claimableRedeemAssets(redeemController), depositValue, 6, 5);

        // ============ Generete claimable assets for user1 ============

        // Grand USD and approve tokens for usdcVault
        await grantERC20(user1, USDC, depositValue);
        await USDC.connect(user1).approve(usdcVault, depositValue);

        // Deposit assets in every way
        await usdcVault.connect(user1).requestDeposit(depositValue, user1, user1);

        // Generate yield
        await grantERC20(metaPoolTreasury, USDC, 10n * depositValue - 1n);

        // requestRedeem depositValue
        const tx2 = await usdcVault
            .connect(user1)
            .requestWithdraw(depositValue, redeemController, user1);
        const redeemEvent2 = await findRequestRedeemEventV2(tx2);

        // fulfillRedeemRequests
        expectEqual(await usdcVault.claimableRedeemAssets(redeemController), depositValue);
        await metaPoolTreasury.fulfillRedeemRequests([redeemEvent2.operationId]);
        expectEqual(
            await usdcVault.claimableRedeemAssets(redeemController),
            depositValue * 2n,
            6,
            5,
        );

        // ============ Withdraw assets by controller multiple times per requestId ============

        // withdraw assets by controller by any address for user0 and user1
        expect(await USDC.balanceOf(user0)).to.be.equal(0);
        await redeemController
            .connect(user1)
            .redeem([redeemEvent.operationId, redeemEvent2.operationId]);

        // receive assets by request owner (user0)
        expectEqual(await USDC.balanceOf(user0), depositValue);
        expect(await rebaseTokenV2.balanceOf(user0)).to.be.greaterThan(0);

        // receive assets by request owner (user1)
        expectEqual(await USDC.balanceOf(user1), depositValue);
        expect(await rebaseTokenV2.balanceOf(user1)).to.be.greaterThan(0);

        // second time withdraw assets by controller for same requestId
        await expect(
            redeemController
                .connect(user1)
                .redeem([redeemEvent.operationId, redeemEvent2.operationId]),
        ).to.be.rejectedWith('ERedeemRequestAlreadyRedeemed(');
    });

    it('Should revert withdraw by invalid controller', async () => {
        const { user0, user1, usdcVault, rebaseTokenV2, USDC, metaPoolTreasury, redeemController } =
            await loadFixture(deployCoreV2WithRedeemController);

        const decimals: bigint = await USDC.decimals();
        const depositValue = 100n * 10n ** decimals;

        // ============ Generete claimable assets for user0 with redeemController as controller ============

        // Grand USD and approve tokens for usdcVault
        await grantERC20(user0, USDC, depositValue);
        await USDC.connect(user0).approve(usdcVault, depositValue);

        // Deposit assets in every way
        await usdcVault.connect(user0).requestDeposit(depositValue, user0, user0);

        // Generate yield
        await grantERC20(metaPoolTreasury, USDC, 10n * depositValue - 1n);

        // revert if requestId is not in the `Claimable` state
        await expect(redeemController.connect(user1).redeem([1n])).to.be.rejectedWith(
            'ERedeemRequestNotClaimable(',
        );

        // requestRedeem depositValue
        const tx = await usdcVault
            .connect(user0)
            .requestWithdraw(depositValue, redeemController, user0);
        const redeemEvent = await findRequestRedeemEventV2(tx);

        // fulfillRedeemRequests
        expectEqual(await usdcVault.claimableRedeemAssets(redeemController), 0n);
        // revert if requestId is not in the `Claimable` state
        await expect(
            redeemController.connect(user1).redeem([redeemEvent.operationId]),
        ).to.be.rejectedWith('ERedeemRequestNotClaimable(');

        await metaPoolTreasury.fulfillRedeemRequests([redeemEvent.operationId]);
        expectEqual(await usdcVault.claimableRedeemAssets(redeemController), depositValue, 6, 5);

        // ============ Generete claimable assets for user1 with user1 as controller ============

        // Grand USD and approve tokens for usdcVault
        await grantERC20(user1, USDC, depositValue);
        await USDC.connect(user1).approve(usdcVault, depositValue);

        // Deposit assets in every way
        await usdcVault.connect(user1).requestDeposit(depositValue, user1, user1);

        // Generate yield
        await grantERC20(metaPoolTreasury, USDC, 10n * depositValue - 1n);

        // requestRedeem depositValue
        const tx2 = await usdcVault.connect(user1).requestWithdraw(depositValue, user1, user1);
        const redeemEvent2 = await findRequestRedeemEventV2(tx2);

        // fulfillRedeemRequests
        expectEqual(await usdcVault.claimableRedeemAssets(user1), 0n);
        await metaPoolTreasury.fulfillRedeemRequests([redeemEvent2.operationId]);
        expectEqual(await usdcVault.claimableRedeemAssets(user1), depositValue, 6, 5);

        // ============ Withdraw assets with invalid controller============

        // revert if controller is not the redeemController
        await expect(
            redeemController.connect(user0).redeem([redeemEvent2.operationId]),
        ).to.be.rejectedWith('EInvalidOperator(');

        // withdraw assets by controller by any address for user0
        expect(await USDC.balanceOf(user0)).to.be.equal(0);
        await redeemController.connect(user1).redeem([redeemEvent.operationId]);

        // receive assets by request owner (user0)
        expectEqual(await USDC.balanceOf(user0), depositValue);
        expect(await rebaseTokenV2.balanceOf(user0)).to.be.greaterThan(0);

        // withdraw assets by controller by any address for user1
        expect(await USDC.balanceOf(user1)).to.be.equal(0);
        await usdcVault.connect(user1).withdraw(depositValue - 1n, user1, user1);

        // receive assets by request owner (user1)
        expectEqual(await USDC.balanceOf(user1), depositValue);
        expect(await rebaseTokenV2.balanceOf(user1)).to.be.greaterThan(0);
    });
});
