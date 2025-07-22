/* eslint-disable camelcase, max-lines */
import type { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { time } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import { type AddressLike } from 'ethers';
import { ethers } from 'hardhat';

import { ethMainnetBetaConfig } from '../../configs/ethereum';

import { type StakedUSDe, StakedUSDe__factory, type USDe, USDe__factory } from '../../typechain';
import type { MUSDE } from '../../typechain-types';

import { grantETH } from './grant';

export async function generateRandomWallet() {
    const wallet = ethers.Wallet.createRandom().connect(ethers.provider);
    await ethers.provider.send('hardhat_setBalance', [
        wallet.address,
        '0x21e19e0c9bab2400000', //  (10000 ETH)
    ]);
    return wallet;
}

export async function getEthena() {
    const signers = await ethers.getSigners();
    const signer = signers.at(0)!;
    // Get USDe
    const usde = USDe__factory.connect(ethMainnetBetaConfig.USDE_ADDRESS, signer);
    const usdeMinter = await ethers.getImpersonatedSigner(await usde.minter());
    await grantETH(usdeMinter.address);

    // Get sUSDe
    const susde = StakedUSDe__factory.connect(ethMainnetBetaConfig.SUSDE_ADDRESS, signer);
    return { usde, susde, usdeMinter };
}

export async function grantStakedUSDE(
    user: AddressLike,
    susdeAmount: bigint,
    usde: USDe,
    susde: StakedUSDe,
    usdeMinter: HardhatEthersSigner,
) {
    const balance0 = await susde.balanceOf(user);

    await grantETH(usdeMinter);

    // Accrual of a large number of USDe tokens for `usdeMinter`
    const usdeAmount = 2n * (await susde.convertToAssets(susdeAmount));
    // Mint USDe tokens for `usdeMinter`
    await usde.connect(usdeMinter).mint(usdeMinter.address, usdeAmount);

    // `usdeMinter` approves USDe tokens for sUSDe contract
    await usde.connect(usdeMinter).approve(await susde.getAddress(), usdeAmount);
    expect(
        await usde.connect(usdeMinter).allowance(usdeMinter.address, await susde.getAddress()),
    ).to.equal(usdeAmount);

    // `usdeMinter` deposits USDe and gets sUSDe
    expect(await susde.connect(usdeMinter).deposit(usdeAmount, usdeMinter)).to.ok;

    // `usdeMinter` transfers `susdeAmount` to user
    await susde.connect(usdeMinter).transfer(user, susdeAmount);

    // Check that user's balance is increased by `susdeAmount`
    const balance1 = await susde.balanceOf(user);
    expect(balance1 - balance0).to.be.equal(susdeAmount);
}

export async function grantUSDe(
    user: AddressLike,
    usde: USDe,
    usdeMinter: HardhatEthersSigner,
    depositValue: bigint,
) {
    await usde.connect(usdeMinter).mint(usdeMinter.address, depositValue);
    await usde.connect(usdeMinter).transfer(user, depositValue);
}

export async function mintmUSDe(
    ownerAddress: string, // owner of mUSDe token
    usdeMinter: HardhatEthersSigner,
    usde: USDe,
    susde: StakedUSDe,
    musde: MUSDE,
    susdeDepositValue: bigint,
) {
    const owner = await ethers.getImpersonatedSigner(ownerAddress);

    await grantStakedUSDE(owner.address, susdeDepositValue, usde, susde, usdeMinter);

    // User approves sUSDe for the mUSDe contract
    await susde.connect(owner).approve(await musde.getAddress(), susdeDepositValue);
    expect(await susde.connect(owner).allowance(owner.address, await musde.getAddress())).to.equal(
        susdeDepositValue,
    );

    // Burn sUSDe, cooldown USDe, and mint mUSDe.
    const txResponse = await musde.connect(owner).cooldownShares(susdeDepositValue);
    const { timestamp } = (await txResponse.getBlock())!;
    await expect(txResponse).to.emit(musde, 'Mint');
    // .withArgs(owner.address, usdeValue);
    // expect(await musde.balanceOf(owner)).to.equal(usdeValue);
    const usdeValue = await musde.balanceOf(owner);

    // Fail to burn mUSDe and unfreeze USDe
    await expect(musde.connect(owner).unstake()).to.be.rejected;
    const info = await musde.getCooldownInfo();
    expect(info.canUnstake).to.be.false;
    expect(info.cooldownEnd).to.be.equal(BigInt(timestamp) + (await susde.cooldownDuration()));
    expect(info.underlyingAmount).to.be.equal(usdeValue);

    // Jump to the future
    const cooldownDuration = await susde.cooldownDuration();
    await time.increase(cooldownDuration - 1n);
    return usdeValue;
}
