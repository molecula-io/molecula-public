import { expect } from 'chai';
import type { BigNumberish, AddressLike } from 'ethers';
import { ethers } from 'hardhat';

import type { IERC20 } from '../../typechain-types';

import { expectEqual } from './math';

export const FAUCET = {
    DAI: '0xA69babEF1cA67A37Ffaf7a485DfFF3382056e78C',
    USDT: '0xA69babEF1cA67A37Ffaf7a485DfFF3382056e78C',
    ETH: '0xA69babEF1cA67A37Ffaf7a485DfFF3382056e78C',
    AAVE_ETHEREUM_USDT: '0x176F3DAb24a159341c0509bB36B833E7fdd0a132',
    STAKED_FRAX: '0xAAc0aa431c237C2C0B5f041c8e59B3f1a43aC78F',
    WETH: '0xA69babEF1cA67A37Ffaf7a485DfFF3382056e78C',
    aWETH: '0x28a55C4b4f9615FDE3CDAdDf6cc01FcF2E38A6b0',
    USDe: '0xf89d7b9c864f589bbF53a82105107622B35EaA40',
    sUSDe: '0x52Aa899454998Be5b000Ad077a46Bbe360F4e497',
    stETH: '0x176F3DAb24a159341c0509bB36B833E7fdd0a132',
    weETH: '0xEd0C6079229E2d407672a117c22b62064f4a4312',
    rsETH: '0x22162DbBa43fE0477cdC5234E248264eC7C6EA7c',
    ezETH: '0x22162DbBa43fE0477cdC5234E248264eC7C6EA7c',
};

export async function grantETH(wallet: AddressLike, amount: BigNumberish = ethers.parseEther('2')) {
    const signers = await ethers.getSigners();
    const signer = signers.at(19)!;
    const nativeBalance0 = await ethers.provider.getBalance(wallet);
    await signer.sendTransaction({
        to: wallet,
        value: amount,
    });
    const nativeBalance = await ethers.provider.getBalance(wallet);
    expect(nativeBalance - nativeBalance0).to.be.equal(amount);
}

export async function grantERC20(
    wallet: AddressLike,
    token: IERC20,
    amount: BigNumberish,
    faucet: string = FAUCET.USDT,
) {
    // await grantETH(faucet);
    // Prepare an impersonated signer to work as a faucet in the test
    const faucetSigner = await ethers.getImpersonatedSigner(faucet);
    // transfer ERC20 token
    const balance0 = await token.connect(faucetSigner).balanceOf(wallet);
    const bigIntAmount = BigInt(amount);
    if ((await token.balanceOf(faucetSigner)) < bigIntAmount) {
        throw new Error('Not enough balance');
    }
    await token.connect(faucetSigner).transfer(wallet, amount);
    const balance = await token.balanceOf(wallet);

    // used expectEqual for rebase token rounding
    expectEqual(balance - balance0, BigInt(amount));
}
