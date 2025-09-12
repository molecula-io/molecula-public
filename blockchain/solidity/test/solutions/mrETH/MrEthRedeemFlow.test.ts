/* eslint-disable camelcase, max-lines */
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';

import { expectEqual } from '../../utils/math';
import { deployMrETh } from '../../utils/mrETH';

describe('Test mrETH redeem flow', () => {
    describe('General solution tests', () => {
        it('Should successfully redeem immediately WETH', async () => {
            const { depositManagerPool, rewardBearingToken, wEthVault, owner, user0, WETH, aWETH } =
                await loadFixture(deployMrETh);

            // Test deposit value of 1 WETH (18 decimals)
            const val = 1n * 10n ** 18n;

            // Set buffer percentage to 5%
            await depositManagerPool.setBufferPercentage(500n);

            // Verify initial balances
            expect(await WETH.balanceOf(owner)).to.be.greaterThan(val * 32n);
            expect(await WETH.balanceOf(user0)).to.be.greaterThan(val * 32n);
            expect(await aWETH.balanceOf(depositManagerPool)).to.be.equal(0n);

            // Owner deposit into buffer
            await wEthVault.connect(owner).requestDeposit(val, owner, owner);

            // Verify shares and balances after first deposit
            const ownerShares = await rewardBearingToken.sharesOf(owner);

            expectEqual(await aWETH.balanceOf(depositManagerPool), val);

            expectEqual(ownerShares, val);
            expectEqual(await rewardBearingToken.convertToAssets(ownerShares), val);

            // User0 deposit into buffer
            await wEthVault.connect(user0).requestDeposit(val, user0, user0);

            const user0BalanceBeforeRedeem = await WETH.balanceOf(user0);
            const ownerBalanceBeforeRedeem = await WETH.balanceOf(owner);

            // Verify shares and balances after second deposit
            const user0Shares = await rewardBearingToken.sharesOf(user0);
            expectEqual(await rewardBearingToken.convertToAssets(user0Shares), val);

            const ownerImmediateWithdrawableAssets =
                await wEthVault.previewImmediateRedeem(ownerShares);

            // Owner redeem immediately
            await wEthVault.connect(owner).redeemImmediately(ownerShares, owner, owner);

            const ownerWithdrawableAssets = await wEthVault.claimableRedeemAssets(owner);

            expect(ownerWithdrawableAssets).to.be.equal(0n);
            expect(await rewardBearingToken.sharesOf(owner)).to.be.equal(0n);
            expect(await WETH.balanceOf(wEthVault)).to.be.equal(0n);
            expectEqual(
                await WETH.balanceOf(owner),
                ownerBalanceBeforeRedeem + ownerImmediateWithdrawableAssets,
                18,
                9,
            );

            // User0 redeem immediately
            const user0ImmediateWithdrawableAssets =
                await wEthVault.previewImmediateRedeem(user0Shares);
            await wEthVault.connect(user0).redeemImmediately(user0Shares, user0, user0);

            const user0WithdrawableAssets = await wEthVault.claimableRedeemAssets(user0);

            expect(user0WithdrawableAssets).to.be.equal(0n);
            expect(await rewardBearingToken.sharesOf(user0)).to.be.equal(0n);
            expect(await WETH.balanceOf(wEthVault)).to.be.equal(0n);
            expectEqual(
                await WETH.balanceOf(user0),
                user0BalanceBeforeRedeem + user0ImmediateWithdrawableAssets,
                18,
                9,
            );

            // Withdrawable assets in vault
            const sharesInVault = await rewardBearingToken.sharesOf(wEthVault);
            const assetsInVault = await rewardBearingToken.convertToAssets(sharesInVault);

            // A lit bit bigger than the sum of the withdrawable assets, by aave yield
            expect(assetsInVault).to.be.greaterThan(
                val * 2n - user0ImmediateWithdrawableAssets - ownerImmediateWithdrawableAssets,
            );

            // Distribute yield
            await wEthVault.connect(owner).distributeYield(owner, sharesInVault);

            expect(await rewardBearingToken.sharesOf(wEthVault)).to.be.equal(0n);
            expect(await rewardBearingToken.sharesOf(owner)).to.be.equal(sharesInVault);
        });

        it('Should successfully redeem immediately ETH', async () => {
            const { depositManagerPool, rewardBearingToken, nativeVault, owner, aWETH } =
                await loadFixture(deployMrETh);

            const { provider } = ethers;

            // Test deposit value of 1 WETH (18 decimals)
            const val = 1n * 10n ** 18n;

            // Set buffer percentage to 5%
            await depositManagerPool.setBufferPercentage(500n);

            // Deposit native token
            await nativeVault.deposit(val, owner, { value: val });

            // Verify shares and balances after first deposit
            const ownerShares = await rewardBearingToken.sharesOf(owner);

            expectEqual(await aWETH.balanceOf(depositManagerPool), val);
            expectEqual(ownerShares, val);
            expectEqual(await rewardBearingToken.convertToAssets(ownerShares), val);

            expect(await provider.getBalance(nativeVault)).to.be.equal(0n);

            const ownerBalanceBeforeRedeem = await provider.getBalance(owner);
            const ownerImmediateWithdrawableAssets =
                await nativeVault.previewImmediateRedeem(ownerShares);

            // Redeem immediately
            await nativeVault.redeemImmediately(ownerShares, owner, owner);

            const ownerWithdrawableAssets = await nativeVault.claimableRedeemAssets(owner);

            expect(ownerWithdrawableAssets).to.be.equal(0n);
            expect(await nativeVault.claimableRedeemAssets(owner)).to.be.equal(0n);
            expect(await rewardBearingToken.sharesOf(owner)).to.be.equal(0n);
            expect(await provider.getBalance(nativeVault)).to.be.equal(0n);

            // Less because of the gas fee and yield
            expect(await provider.getBalance(owner)).to.be.lessThan(
                ownerBalanceBeforeRedeem + ownerImmediateWithdrawableAssets,
            );
        });

        it('Should revert redeem immediately with zero buffer percentage', async () => {
            const { depositManagerPool, rewardBearingToken, wEthVault, user0, WETH, aWETH } =
                await loadFixture(deployMrETh);

            // Test deposit value of 1 WETH (18 decimals)
            const val = 1n * 10n ** 18n;

            // Set buffer percentage to 0%
            await depositManagerPool.setBufferPercentage(0n);

            // Verify initial balances
            expect(await WETH.balanceOf(user0)).to.be.greaterThan(val * 32n);
            expect(await aWETH.balanceOf(depositManagerPool)).to.be.equal(0n);

            // User0 deposit into buffer
            await wEthVault.connect(user0).requestDeposit(val, user0, user0);

            // Verify shares and balances after first deposit
            const user0Shares = await rewardBearingToken.sharesOf(user0);

            expectEqual(await aWETH.balanceOf(depositManagerPool), val);

            expectEqual(user0Shares, val);
            expectEqual(await rewardBearingToken.convertToAssets(user0Shares), val);

            // Immediate redeemable assets should revert
            await expect(wEthVault.previewImmediateRedeem(user0Shares)).to.be.rejectedWith(
                'EImmediateRedeemNotAllowed()',
            );

            // User0 redeem immediately should revert
            await expect(
                wEthVault.connect(user0).redeemImmediately(user0Shares, user0, user0),
            ).to.be.rejectedWith('EImmediateRedeemNotAllowed()');
        });

        it('Should revert imediately redeem for stETH', async () => {
            const { stEthVault, wEthVault, owner, user0, stETH, depositManagerPool } =
                await loadFixture(deployMrETh);

            // Test deposit value of 1 WETH
            const val = 1n * 10n ** 18n;

            // Set buffer percentage to 5%
            await depositManagerPool.setBufferPercentage(500n);

            // Verify initial balances
            expect(await stETH.balanceOf(owner)).to.be.greaterThan(val * 2n);

            // Perform deposit request
            await stEthVault.connect(owner).requestDeposit(val, owner, owner);

            await expect(
                stEthVault.connect(owner).redeemImmediately(val, owner, owner),
            ).to.be.rejectedWith('EBalanceBeforeLessThanValue()');

            // User0 deposit into buffer
            await wEthVault.connect(user0).requestDeposit(val, user0, user0);

            await expect(
                stEthVault.connect(owner).redeemImmediately(val, owner, owner),
            ).to.be.rejectedWith('EUnsupportedRedeemFromBufferToken()');
        });

        it('Should revert imediately redeem for non token vault', async () => {
            const { owner, depositManagerPool } = await loadFixture(deployMrETh);

            await expect(
                depositManagerPool.connect(owner).fulfillRedeemImmediately([1n]),
            ).to.be.rejectedWith('TokenVaultNotAllowed()');

            await expect(
                depositManagerPool.connect(owner).fulfillRedeemImmediatelyForNativeToken([1n]),
            ).to.be.rejectedWith('TokenVaultNotAllowed()');
        });
    });
});
