/* eslint-disable camelcase, max-lines, no-await-in-loop, no-restricted-syntax, no-bitwise, no-plusplus */
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';

import { deployCoreV2RewardBearingToken } from '../../utils/CoreV2WithRewardBearingToken';
import { findRequestRedeemEventV2 } from '../../utils/event';
import { grantERC20 } from '../../utils/grant';
import { expectEqual } from '../../utils/math';

describe('RewardBearingToken', () => {
    it('Using RewardBearingToken', async () => {
        const { user0, usdcVault, rewardBearingToken, USDC, metaPoolTreasury } = await loadFixture(
            deployCoreV2RewardBearingToken,
        );

        const decimals: bigint = await USDC.decimals();
        const depositValue = 100n * 10n ** decimals;

        // Grand USD and approve tokens for usdcVault
        await grantERC20(user0, USDC, depositValue);
        await USDC.connect(user0).approve(usdcVault, depositValue);

        // Deposit assets
        const shares = await usdcVault.previewDeposit(depositValue);
        await usdcVault.connect(user0).requestDeposit(depositValue, user0, user0);
        expect(await rewardBearingToken.balanceOf(user0)).to.be.equal(shares);

        // Generate yield
        await grantERC20(metaPoolTreasury, USDC, 10n * depositValue - 1n);
        // Balance is not changed
        expect(await rewardBearingToken.balanceOf(user0)).to.be.equal(shares);

        // requestRedeem
        const userShares = await rewardBearingToken.balanceOf(user0);
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
});
