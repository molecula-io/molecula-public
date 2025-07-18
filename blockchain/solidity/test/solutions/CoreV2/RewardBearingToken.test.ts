/* eslint-disable camelcase, max-lines, no-await-in-loop, no-restricted-syntax, no-bitwise, no-plusplus */
import { days } from '@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time/duration';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';

import { keccak256 } from 'ethers';
import { ethers } from 'hardhat';

import { deployCoreV2RewardBearingToken } from '../../utils/CoreV2WithRewardBearingToken';
import { findRequestRedeemEventV2 } from '../../utils/event';
import { grantERC20 } from '../../utils/grant';
import { expectEqual } from '../../utils/math';
import { signERC2612Permit } from '../../utils/sign';

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

    it('Test permit, view functions and errors', async () => {
        const signers = await ethers.getSigners();
        const poolOwner = signers.at(1)!;
        const user0 = signers.at(2)!;
        const user1 = signers.at(3)!;

        const MockOracle = await ethers.getContractFactory('MockOracleV2');
        const mockOracle = await MockOracle.connect(poolOwner).deploy(150, 100, poolOwner);

        const RewardBearingToken = await ethers.getContractFactory('RewardBearingToken');
        const rewardBearingToken = await RewardBearingToken.connect(poolOwner).deploy(
            'Test Molecula Rebase Token V2',
            'TMRTV2',
            poolOwner,
            mockOracle,
            ethers.ZeroAddress,
        );

        const MockVault = await ethers.getContractFactory('MockVault');
        const mockVault = await MockVault.connect(poolOwner).deploy(poolOwner, rewardBearingToken);

        const codeHash = keccak256((await mockVault.getDeployedCode())!);
        await rewardBearingToken.setCodeHash(codeHash, true);
        await rewardBearingToken.addTokenVault(mockVault);

        const deadline = Date.now() + days(10);
        const sign = await signERC2612Permit(
            await rewardBearingToken.name(),
            '2.0.0',
            await rewardBearingToken.getAddress(),
            user0.address,
            user1.address,
            100,
            deadline,
            0,
            user0,
        );

        await rewardBearingToken
            .connect(user1)
            .permit(sign.owner, sign.spender, sign.value, sign.deadline, sign.v, sign.r, sign.s);
        expect(await rewardBearingToken.allowance(user0, user1)).to.be.equal(100);

        expect(await rewardBearingToken.totalSupply()).to.be.equal(150);
        expect(await rewardBearingToken.totalSharesSupply()).to.be.equal(150);
        expect(await rewardBearingToken.localTotalShares()).to.be.equal(0);
        await mockVault.connect(poolOwner).mint(user0, 200);
        expect(await rewardBearingToken.totalSupply()).to.be.equal(150);
        expect(await rewardBearingToken.totalSharesSupply()).to.be.equal(150);
        expect(await rewardBearingToken.localTotalShares()).to.be.equal(200);

        await rewardBearingToken.connect(poolOwner).transferOwnership(user0);
        await rewardBearingToken.connect(user0).acceptOwnership();
        expect(await rewardBearingToken.owner()).to.be.equal(user0);

        await expect(rewardBearingToken.connect(poolOwner).mint(user0, 1)).to.be.rejectedWith(
            'ENotAuthorized()',
        );
        await expect(rewardBearingToken.connect(poolOwner).burn(user0, 1)).to.be.rejectedWith(
            'ENotAuthorized()',
        );
    });
});
