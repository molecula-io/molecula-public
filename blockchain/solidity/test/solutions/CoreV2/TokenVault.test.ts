/* eslint-disable camelcase, max-lines, no-await-in-loop, no-restricted-syntax, no-bitwise, no-plusplus */

import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';

import { deployCoreV2, deployCoreV2WithoutInit } from '../../utils/CoreV2';
import { findRequestRedeemEventV2 } from '../../utils/event';
import { grantERC20 } from '../../utils/grant';

describe('Token Vault', () => {
    it('Check init params', async () => {
        const { usdcVault, USDC } = await loadFixture(deployCoreV2WithoutInit);

        await expect(usdcVault.init(USDC, 0, 1)).to.be.rejectedWith('EZeroValue()');
        await expect(usdcVault.init(USDC, 1, 0)).to.be.rejectedWith('EZeroValue()');
        await usdcVault.init(USDC, 1, 2);

        await expect(usdcVault.setMinDepositAssets(0)).to.be.rejectedWith('EZeroValue()');
        await expect(usdcVault.setMinRedeemShares(0)).to.be.rejectedWith('EZeroValue()');

        expect(await usdcVault.isRequestDepositPaused()).to.be.true;
        expect(await usdcVault.isRequestRedeemPaused()).to.be.true;
    });

    it('Check zero params', async () => {
        const { usdcVault, USDC, user0, rebaseTokenV2, metaPoolTreasury } =
            await loadFixture(deployCoreV2);

        const decimals: bigint = await USDC.decimals();
        const depositValue = 100n * 10n ** decimals;

        // Grand USD and approve tokens for tokenUSDCVault
        await grantERC20(user0, USDC, depositValue);
        await USDC.connect(user0).approve(usdcVault, depositValue);

        // user0 deposits tokens
        await expect(
            usdcVault.connect(user0).requestDeposit(depositValue, ethers.ZeroAddress, user0),
        ).to.be.rejectedWith('EZeroAddress(');
        await expect(
            usdcVault.connect(user0).requestDeposit(depositValue, user0, ethers.ZeroAddress),
        ).to.be.rejectedWith('EInvalidOperator(');
        await usdcVault.connect(user0).requestDeposit(depositValue, user0, user0);

        // requestRedeem
        const shares = await rebaseTokenV2.sharesOf(user0);
        await expect(
            usdcVault.connect(user0).requestRedeem(shares, ethers.ZeroAddress, user0),
        ).to.be.rejectedWith('EZeroAddress()');
        await expect(
            usdcVault.connect(user0).requestRedeem(shares, user0, ethers.ZeroAddress),
        ).to.be.rejectedWith('EInvalidOperator(');
        const tx = await usdcVault.connect(user0).requestRedeem(shares, user0, user0);
        const redeemEvent = await findRequestRedeemEventV2(tx);

        // fulfillRedeemRequests
        await metaPoolTreasury.fulfillRedeemRequests([redeemEvent.operationId]);

        // redeem
        await usdcVault.connect(user0).redeem(shares, user0, user0);
        await expect(usdcVault.connect(user0).redeem(0, user0, user0)).to.be.rejectedWith(
            'EZeroValue()',
        );
        await expect(
            usdcVault.connect(user0).redeem(shares, user0, ethers.ZeroAddress),
        ).to.be.rejectedWith('EInvalidOperator(');
        await expect(
            usdcVault.connect(user0).redeem(shares, ethers.ZeroAddress, user0),
        ).to.be.rejectedWith('EZeroAddress()');
    });

    it('Deposit native token', async () => {
        const { nativeTokenVault, user0, user1, rebaseTokenV2, metaPoolTreasury } =
            await loadFixture(deployCoreV2);
        const { provider } = ethers;

        expect(await provider.getBalance(metaPoolTreasury)).to.be.equal(0);

        // user deposits eth
        const decimals = 18n;
        const depositValue = 10n ** decimals;
        expect(await rebaseTokenV2.sharesOf(user0)).to.be.equal(0);
        await nativeTokenVault.connect(user0).deposit(0, user0, { value: depositValue });
        expect(await rebaseTokenV2.sharesOf(user0)).to.be.equal(depositValue);
        expect(await provider.getBalance(metaPoolTreasury)).to.be.equal(depositValue);

        // Request redeem
        const shares = await rebaseTokenV2.sharesOf(user0);
        const tx = await nativeTokenVault.connect(user0).requestRedeem(shares, user0, user0);
        const redeemEvent = await findRequestRedeemEventV2(tx);

        // Fulfilling
        await metaPoolTreasury.fulfillRedeemRequestsForNativeToken([redeemEvent.operationId]);
        const claimableAssets = await nativeTokenVault.claimableRedeemAssets(user0);
        expect(claimableAssets).to.be.equal(redeemEvent.redeemValue);

        // user0 withdraws native tokens for user1
        const user1Balance = await provider.getBalance(user1);
        await nativeTokenVault.connect(user0).withdraw(claimableAssets, user1, user0);
        expect(await provider.getBalance(user1)).to.be.equal(
            user1Balance + redeemEvent.redeemValue,
        );
    });
});
