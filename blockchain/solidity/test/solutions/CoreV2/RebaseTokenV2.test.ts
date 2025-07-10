/* eslint-disable camelcase, max-lines, no-await-in-loop, no-restricted-syntax, no-bitwise, no-plusplus */
import { days } from '@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time/duration';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';

import { deployCoreV2 } from '../../utils/CoreV2';
import { FAUCET, grantERC20 } from '../../utils/grant';
import { expectEqual } from '../../utils/math';
import { signERC2612Permit } from '../../utils/sign';

describe('RebaseTokenV2', () => {
    it('Test total supply: USDC (6 decimals)', async () => {
        const { rebaseTokenV2, USDC, metaPoolTreasury, supplyManagerV2 } =
            await loadFixture(deployCoreV2);

        const virtualOffset = 10n ** 18n;
        let totalSupply = await rebaseTokenV2.totalSupply();
        let totalSharesSupply = await rebaseTokenV2.totalSharesSupply();
        expect(totalSupply).to.be.equal(virtualOffset);
        expect(totalSharesSupply).to.be.equal(virtualOffset);

        await grantERC20(metaPoolTreasury, USDC, 1);
        totalSupply = await rebaseTokenV2.totalSupply();
        totalSharesSupply = await rebaseTokenV2.totalSharesSupply();
        expect(totalSupply).to.be.equal(4n * 10n ** 11n + virtualOffset); // 60% is for APY
        expect(totalSharesSupply).to.be.equal(virtualOffset);

        expect(await rebaseTokenV2.decimals()).to.be.equal(18);

        expect(await supplyManagerV2.convertToShares(totalSupply)).to.be.equal(totalSharesSupply);
        expect(await supplyManagerV2.convertToAssets(totalSharesSupply)).to.be.equal(totalSupply);
    });

    it('Test transfer/transferFrom/approve', async () => {
        const { user0, user1, USDe, usdeVault, rebaseTokenV2, metaPoolTreasury } =
            await loadFixture(deployCoreV2);

        const decimals: bigint = await USDe.decimals();
        const depositValue = 100n * 10n ** decimals - 1n;

        // Grand USD and approve tokens for usdeVault
        await grantERC20(user0, USDe, depositValue, FAUCET.USDe);
        await USDe.connect(user0).approve(usdeVault, depositValue);

        // user0 sets operator and deposit tokens
        await usdeVault
            .connect(user0)
            ['deposit(uint256,address,address)'](depositValue, user0, user0);

        let mUSDAmount = await rebaseTokenV2.balanceOf(user0);
        expect(mUSDAmount).to.be.equal(100n * 10n ** 18n - 1n);

        await grantERC20(metaPoolTreasury, USDe, depositValue, FAUCET.USDe);
        mUSDAmount = await rebaseTokenV2.balanceOf(user0);

        // user0 transfers tokens to user1
        const transferAmount = (2n * mUSDAmount) / 3n;
        await rebaseTokenV2.connect(user0).transfer(user1, transferAmount);
        expectEqual(await rebaseTokenV2.balanceOf(user0), mUSDAmount - transferAmount);
        expectEqual(await rebaseTokenV2.balanceOf(user1), transferAmount);

        // user1 approves tokens for user0 and user0 calls `transferFrom`
        await rebaseTokenV2.connect(user1).approve(user0, transferAmount);
        await rebaseTokenV2.connect(user0).transferFrom(user1, user0, transferAmount);
        expect(await rebaseTokenV2.balanceOf(user0)).to.be.equal(mUSDAmount);
        expect(await rebaseTokenV2.balanceOf(user1)).to.be.equal(0);

        // user0 approves all tokens for user1 and user1 calls `transferFrom`
        await rebaseTokenV2.connect(user0).approve(user1, ethers.MaxUint256);
        await rebaseTokenV2.connect(user1).transferFrom(user0, user1, mUSDAmount);
        expectEqual(await rebaseTokenV2.balanceOf(user0), 0n);
        expectEqual(await rebaseTokenV2.balanceOf(user1), mUSDAmount);
    });

    it('Test remove token vault', async () => {
        const { rebaseTokenV2, usdcVault } = await loadFixture(deployCoreV2);

        expect(await rebaseTokenV2.isTokenVaultAllowed(usdcVault)).to.be.true;
        await rebaseTokenV2.removeTokenVault(usdcVault);
        expect(await rebaseTokenV2.isTokenVaultAllowed(usdcVault)).to.be.false;
    });

    it('Test errors', async () => {
        const { user0, user1, rebaseTokenV2 } = await loadFixture(deployCoreV2);

        const zeroSigner = await ethers.getImpersonatedSigner(ethers.ZeroAddress);
        await expect(rebaseTokenV2.connect(zeroSigner).approve(user0, 1)).to.be.rejectedWith(
            'ERC20InvalidApprover',
        );
        await expect(
            rebaseTokenV2.connect(user0).approve(ethers.ZeroAddress, 1),
        ).to.be.rejectedWith('ERC20InvalidSpender');

        await expect(rebaseTokenV2.connect(user0).transferFrom(user1, user0, 1)).to.be.rejectedWith(
            'ERC20InsufficientAllowance',
        );
        await expect(rebaseTokenV2.connect(user0).transfer(user1, 1)).to.be.rejectedWith(
            'ERC20InsufficientBalance',
        );
        await expect(
            rebaseTokenV2.connect(user0).transfer(ethers.ZeroAddress, 1),
        ).to.be.rejectedWith('ERC20InvalidReceiver');
        await expect(
            rebaseTokenV2.connect(zeroSigner).transfer(ethers.ZeroAddress, 1),
        ).to.be.rejectedWith('ERC20InvalidSender');

        await expect(rebaseTokenV2.connect(user0).mint(user0, 1)).to.be.rejectedWith(
            'ENotAuthorized',
        );
        await expect(rebaseTokenV2.connect(user0).burn(user0, 1)).to.be.rejectedWith(
            'ENotAuthorized',
        );
        await expect(rebaseTokenV2.connect(user0).transferOwnership(user0)).to.be.rejectedWith(
            'OwnableUnauthorizedAccount',
        );

        await expect(rebaseTokenV2.connect(user0).setOracle(user0)).to.be.rejectedWith(
            'OwnableUnauthorizedAccount',
        );
        await expect(rebaseTokenV2.setOracle(ethers.ZeroAddress)).to.be.rejectedWith(
            'EZeroAddress',
        );
        await rebaseTokenV2.setOracle(user0);
        expect(await rebaseTokenV2.oracle()).to.be.equal(user0);

        await expect(rebaseTokenV2.validateTokenVault(user0)).to.be.rejectedWith(
            'TokenVaultNotAllowed',
        );
    });

    it('Test permit', async () => {
        const { user0, user1, rebaseTokenV2 } = await loadFixture(deployCoreV2);

        const deadline = Date.now() + days(10);
        const sign = await signERC2612Permit(
            await rebaseTokenV2.name(),
            '2.0.0',
            await rebaseTokenV2.getAddress(),
            user0.address,
            user1.address,
            100,
            deadline,
            0,
            user0,
        );
        await rebaseTokenV2
            .connect(user1)
            .permit(sign.owner, sign.spender, sign.value, sign.deadline, sign.v, sign.r, sign.s);

        await expect(
            rebaseTokenV2
                .connect(user1)
                .permit(sign.owner, sign.spender, sign.value, 0, sign.v, sign.r, sign.s),
        ).to.be.rejectedWith('ERC2612ExpiredSignature(');

        await expect(
            rebaseTokenV2
                .connect(user1)
                .permit(
                    user1.address,
                    sign.spender,
                    sign.value,
                    sign.deadline,
                    sign.v,
                    sign.r,
                    sign.s,
                ),
        ).to.be.rejectedWith('ERC2612InvalidSigner(');

        await rebaseTokenV2.DOMAIN_SEPARATOR();
        expect(await rebaseTokenV2.nonces(user0.address)).to.be.equal(1);
        expect(await rebaseTokenV2.nonces(user1.address)).to.be.equal(0);
    });
});
