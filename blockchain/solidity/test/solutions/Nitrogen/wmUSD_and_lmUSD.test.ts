/* eslint-disable camelcase, max-lines, no-await-in-loop, no-restricted-syntax, no-bitwise, no-plusplus */
import { days } from '@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time/duration';
import { loadFixture, time } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';

import { ethMainnetBetaConfig } from '../../../configs';
import { deployNitrogenWithUSDT, getRidOf } from '../../utils/NitrogenCommon';
import { findTransferEvent } from '../../utils/event';
import { grantERC20 } from '../../utils/grant';
import { expectEqual } from '../../utils/math';

describe('Test wmUSD and lmUSD', () => {
    describe('Test wmUSD', () => {
        it('wmUSD main flow', async () => {
            const {
                moleculaPool,
                rebaseToken,
                wmusd,
                yieldDistributor,
                agent,
                user0,
                USDT,
                lmUSDHolder,
            } = await loadFixture(deployNitrogenWithUSDT);
            await wmusd.setYieldDistributor(yieldDistributor);

            // deposit 100 USDT
            const depositValue = 100_000_000n - 1n;
            // Grant user wallet with 100 USDT
            await grantERC20(user0, USDT, depositValue);
            // approve USDT to agent
            await USDT.connect(user0).approve(await agent.getAddress(), depositValue);
            // user0 calls requestDeposit on rebaseToken
            await rebaseToken.connect(user0).requestDeposit(depositValue, user0, user0);

            // Generate income. Make x2 share price.
            // User gets 40% of the income
            const income = 500_000_000n;
            await grantERC20(moleculaPool.getAddress(), USDT, income);

            const mUSDUserBalance = await rebaseToken.balanceOf(user0);

            // Wrap: convert mUSD -> wmUSD
            await rebaseToken.connect(user0).approve(wmusd.getAddress(), ethers.MaxUint256);
            await wmusd.connect(user0).wrap(mUSDUserBalance);
            // Should be equal with some precision
            expectEqual(await rebaseToken.balanceOf(wmusd), mUSDUserBalance, 18, 16);
            // Note: user can't transfer all balance due to rounding error
            expect(await rebaseToken.balanceOf(user0)).to.be.greaterThan(0);
            expect(await wmusd.balanceOf(user0)).to.be.equal(mUSDUserBalance);

            // Check that there is no yield
            expect(await wmusd.currentYield()).to.be.equal(0);
            expect(await wmusd.currentYieldShares()).to.be.equal(0);

            // Generate income
            await grantERC20(moleculaPool.getAddress(), USDT, income);

            // Check that yield in wmUSD is increased
            const currentYield = await wmusd.currentYield();
            const currentYieldShares = await wmusd.currentYieldShares();
            expect(currentYield).to.be.greaterThan(0);
            expect(currentYieldShares).to.be.greaterThan(0);

            // Distribute yield
            await wmusd
                .connect(yieldDistributor)
                .distributeYield(lmUSDHolder.address, currentYieldShares / 3n);
            expectEqual(await wmusd.currentYieldShares(), (2n * currentYieldShares) / 3n);
            expectEqual(await rebaseToken.sharesOf(lmUSDHolder), currentYieldShares / 3n);

            // Unwrap: convert wmUSD -> mUSD
            await wmusd.connect(user0).unwrap(mUSDUserBalance);
            expectEqual(await rebaseToken.balanceOf(user0), mUSDUserBalance);
            expect(await wmusd.balanceOf(user0)).to.be.equal(0);
        });

        it('wrap and unwrap flow without income', async () => {
            const { rebaseToken, wmusd, agent, user0, USDT } =
                await loadFixture(deployNitrogenWithUSDT);

            // deposit 100 USDT
            const depositValue = 100_000_000n - 1n;
            // Grant user wallet with 100 USDT
            await grantERC20(user0, USDT, depositValue);
            // approve USDT to agent
            await USDT.connect(user0).approve(await agent.getAddress(), depositValue);
            // user0 calls requestDeposit on rebaseToken
            await rebaseToken.connect(user0).requestDeposit(depositValue, user0, user0);

            const mUSDUserBalance = await rebaseToken.balanceOf(user0);

            // Wrap: convert mUSD -> wmUSD
            await rebaseToken.connect(user0).approve(wmusd.getAddress(), ethers.MaxUint256);
            await wmusd.connect(user0).wrap(mUSDUserBalance);
            // Should be equal with some precision
            expectEqual(await rebaseToken.balanceOf(wmusd), mUSDUserBalance, 18, 16);
            // Note: user can't transfer all balance due to rounding error
            expectEqual(await rebaseToken.balanceOf(user0), 0n, 18, 16);
            expect(await wmusd.balanceOf(user0)).to.be.equal(mUSDUserBalance);

            // Unwrap: convert wmUSD -> mUSD
            await wmusd.connect(user0).unwrap(mUSDUserBalance);
            expectEqual(await rebaseToken.balanceOf(user0), mUSDUserBalance);
            expect(await wmusd.balanceOf(user0)).to.be.equal(0);
        });

        it('wrap and unwrap flow with losing totalSupply', async () => {
            const {
                rebaseToken,
                wmusd,
                agent,
                user0,
                USDT,
                moleculaPool,
                poolOwner,
                randAccount,
                poolKeeper,
            } = await loadFixture(deployNitrogenWithUSDT);

            // deposit 100 USDT
            const depositValue = 100_000_000n - 1n;
            // Grant user wallet with 100 USDT
            await grantERC20(user0, USDT, depositValue);
            // approve USDT to agent
            await USDT.connect(user0).approve(await agent.getAddress(), depositValue);
            // user0 calls requestDeposit on rebaseToken
            await rebaseToken.connect(user0).requestDeposit(depositValue, user0, user0);

            const mUSDUserBalance = await rebaseToken.balanceOf(user0);

            // Wrap: convert mUSD -> wmUSD
            await rebaseToken.connect(user0).approve(wmusd.getAddress(), ethers.MaxUint256);
            await wmusd.connect(user0).wrap(mUSDUserBalance);
            // Should be equal with some precision
            expectEqual(await rebaseToken.balanceOf(wmusd), mUSDUserBalance, 18, 16);
            // Note: user can't transfer all balance due to rounding error
            expectEqual(await rebaseToken.balanceOf(user0), 0n, 18, 16);
            expect(await wmusd.balanceOf(user0)).to.be.equal(mUSDUserBalance);

            // get rid of USDT from moleculaPool
            await getRidOf(moleculaPool, poolOwner, USDT, randAccount.address, poolKeeper);

            for (const value of [mUSDUserBalance / 3n, mUSDUserBalance - mUSDUserBalance / 3n]) {
                // Unwrap: convert wmUSD -> mUSD
                await wmusd.connect(user0).unwrap(value);
            }
            // Note: user's balance is decreased
            expect(await rebaseToken.balanceOf(user0)).to.be.lessThan(mUSDUserBalance);
            expect(await wmusd.balanceOf(user0)).to.be.equal(0);

            expect(await wmusd.totalSupply()).to.be.equal(0);
            expectEqual(await wmusd.totalShares(), 0n);
        });

        it('Test conner cases', async () => {
            const {
                wmusd,
                agent,
                randAccount,
                poolOwner,
                rebaseToken,
                user0,
                lmUSDHolder,
                USDT,
                moleculaPool,
                yieldDistributor,
            } = await loadFixture(deployNitrogenWithUSDT);
            await wmusd.setYieldDistributor(yieldDistributor);

            // test distributeYield
            await expect(
                wmusd.connect(randAccount).distributeYield(ethers.ZeroAddress, 0),
            ).to.be.rejectedWith('ENotYieldDistributor(');
            await expect(
                wmusd
                    .connect(yieldDistributor)
                    .distributeYield(lmUSDHolder.address, ethers.MaxUint256),
            ).to.be.rejectedWith('ETooManyShares()');

            // deposit 100 USDT
            const depositValue = 100_000_000n - 1n;
            // Grant user wallet with 100 USDT
            await grantERC20(user0, USDT, depositValue);
            // approve USDT to agent
            await USDT.connect(user0).approve(await agent.getAddress(), depositValue);
            // user0 calls requestDeposit on rebaseToken
            await rebaseToken.connect(user0).requestDeposit(depositValue, user0, user0);
            // Wrap: convert mUSD -> wmUSD
            await rebaseToken.connect(user0).approve(wmusd.getAddress(), ethers.MaxUint256);
            await wmusd.connect(user0).wrap(await rebaseToken.balanceOf(user0));
            // Generate income
            await grantERC20(moleculaPool.getAddress(), USDT, 500_000_000n);

            // test setYieldDistributor
            await expect(
                wmusd.connect(randAccount).setYieldDistributor(randAccount),
            ).to.be.rejectedWith('OwnableUnauthorizedAccount');
            await expect(
                wmusd.connect(poolOwner).setYieldDistributor(ethers.ZeroAddress),
            ).to.be.rejectedWith('EZeroAddress()');
            await wmusd.connect(poolOwner).setYieldDistributor(randAccount);
            expect(await wmusd.yieldDistributor()).to.be.equal(randAccount);
        });

        it('Test voting', async () => {
            const { moleculaPool, rebaseToken, wmusd, agent, user0, USDT, user1 } =
                await loadFixture(deployNitrogenWithUSDT);

            // deposit ~100 USDT
            const depositValue = 100_000_000n - 1n;
            // Grant user wallet with 100 USDT
            await grantERC20(user0, USDT, depositValue);
            // approve USDT to agent
            await USDT.connect(user0).approve(await agent.getAddress(), depositValue);
            // user0 calls requestDeposit on rebaseToken
            await rebaseToken.connect(user0).requestDeposit(depositValue, user0, user0);

            // User gets 40% of the income
            const income = 500_000_000n;
            await grantERC20(moleculaPool.getAddress(), USDT, income);

            const mUSDUserBalance = await rebaseToken.balanceOf(user0);
            const mUSDAmount = mUSDUserBalance / 10n; // Just some part of user's balance

            // Wrap: convert mUSD -> wmUSD
            await rebaseToken.connect(user0).approve(wmusd.getAddress(), ethers.MaxUint256);

            // user0 wraps their wmUSD and gets no voting power
            await wmusd.connect(user0).wrap(mUSDAmount);
            expect(await wmusd.balanceOf(user0)).to.be.equal(mUSDAmount);
            expect(await wmusd.getVotes(user0)).to.be.equal(0);

            // user0 gets voting power
            await wmusd.connect(user0).delegate(user0);
            expect(await wmusd.balanceOf(user0)).to.be.equal(mUSDAmount);
            expect(await wmusd.getVotes(user0)).to.be.equal(mUSDAmount);

            // user0 renounces voting power
            await wmusd.connect(user0).delegate(ethers.ZeroAddress);
            expect(await wmusd.balanceOf(user0)).to.be.equal(mUSDAmount);
            expect(await wmusd.getVotes(user0)).to.be.equal(0);

            // user0 wraps their wmUSD and delegates voting power to user1
            await wmusd.connect(user0).delegate(user1);
            await wmusd.connect(user0).wrap(mUSDAmount);
            expect(await wmusd.balanceOf(user0)).to.be.equal(2n * mUSDAmount);
            expect(await wmusd.getVotes(user0)).to.be.equal(0);
            expect(await wmusd.getVotes(user1)).to.be.equal(2n * mUSDAmount);
        });

        it('Coverage', async () => {
            const { wmusd, user0 } = await loadFixture(deployNitrogenWithUSDT);

            expect(await wmusd.CLOCK_MODE()).to.be.equal('mode=blocknumber&from=default');
            expect(await wmusd.nonces(user0)).to.be.equal(0);
            expect(await wmusd.supportsInterface('0x11223344')).to.be.equal(false);

            const supportedInterfaceIDs = [
                '0x36372b07', // IERC20
                '0x9d8ff7da', // IERC20Permit
                '0xda287a1d', // IERC6372
                '0xe90fb3f6', // IVotes
                '0x01ffc9a7', // IERC165
            ];
            for (const interfaceId of supportedInterfaceIDs) {
                expect(await wmusd.supportsInterface(interfaceId)).to.be.equal(true);
            }
        });

        it('wmUSD bridge', async () => {
            const { moleculaPool, rebaseToken, wmusd, agent, user0, USDT } =
                await loadFixture(deployNitrogenWithUSDT);

            // deposit 100 USDT
            const depositValue = 100_000_000n;
            // Generated income
            const income = 500_000_000n;

            await USDT.connect(user0).approve(await agent.getAddress(), ethers.MaxUint256);
            await rebaseToken.connect(user0).approve(wmusd.getAddress(), ethers.MaxUint256);

            // generate income
            await grantERC20(moleculaPool.getAddress(), USDT, income);

            // User gets mUSD and wrap it
            await grantERC20(user0, USDT, depositValue);
            await rebaseToken.connect(user0).requestDeposit(depositValue, user0, user0);
            await wmusd.connect(user0).wrap(await rebaseToken.balanceOf(user0));
            const mUSDWrappedShares0 = await wmusd.totalShares();

            // generate income
            await grantERC20(moleculaPool.getAddress(), USDT, income);

            // User gets mUSD and wrap it
            await grantERC20(user0, USDT, depositValue);
            await rebaseToken.connect(user0).requestDeposit(depositValue, user0, user0);
            await wmusd.connect(user0).wrap(await rebaseToken.balanceOf(user0));
            const mUSDWrappedShares1 = (await wmusd.totalShares()) - mUSDWrappedShares0;

            // generate income
            await grantERC20(moleculaPool.getAddress(), USDT, income);

            // Check
            const balance = await rebaseToken.balanceOf(wmusd);
            const mUSDWrappedShares3 = await rebaseToken.convertToShares(balance);
            expectEqual(mUSDWrappedShares3, mUSDWrappedShares0 + mUSDWrappedShares1);
        });
    });

    describe('Test lmUSD', () => {
        it('lmUSD main flow', async () => {
            const { rebaseToken, agent, user0, wmusd, user1, moleculaPool, USDT, lmusd } =
                await loadFixture(deployNitrogenWithUSDT);

            // deposit 100 USDT
            const depositValue = 100_000_000n - 1n;
            // Grant user wallet with 100 USDT
            await grantERC20(user0, USDT, depositValue);
            // approve USDT to agent
            await USDT.connect(user0).approve(await agent.getAddress(), depositValue);
            // user0 calls requestDeposit on rebaseToken
            await rebaseToken.connect(user0).requestDeposit(depositValue, user0, user0);

            const mUSDAmount = await rebaseToken.balanceOf(user0);

            // user0 locks their tokens and gets NFT
            await rebaseToken.connect(user0).approve(lmusd, mUSDAmount);
            const tx = await lmusd.connect(user0).lock(mUSDAmount, days(7));
            const { tokenId } = await findTransferEvent(tx);

            let { lockedShares, dedicatedShares } = await lmusd.sharesOf(tokenId);
            expect(lockedShares).to.be.equal(mUSDAmount);
            expect(dedicatedShares).to.be.equal(0);

            // user1 deposits 100 USDT
            const depositValue2 = 500_000_000n - 1n;
            // Grant user wallet with 100 USDT
            await grantERC20(user1, USDT, depositValue2);
            // approve USDT to agent
            await USDT.connect(user1).approve(await agent.getAddress(), depositValue2);
            // user1 calls requestDeposit on rebaseToken
            await rebaseToken.connect(user1).requestDeposit(depositValue2, user1, user1);

            // user1 converts mUSD -> wmUSD
            await rebaseToken.connect(user1).approve(wmusd.getAddress(), ethers.MaxUint256);
            await wmusd.connect(user1).wrap(await rebaseToken.balanceOf(user1));

            // Generate income
            expect(await wmusd.currentYield()).to.be.equal(0);
            const income = 5_000_000_000n;
            await grantERC20(moleculaPool.getAddress(), USDT, income);
            expect(await wmusd.currentYieldShares()).to.be.greaterThan(0);

            // Check user0's shares after generating income
            ({ lockedShares, dedicatedShares } = await lmusd.sharesOf(tokenId));
            expect(lockedShares).to.be.equal(mUSDAmount);
            expect(dedicatedShares).to.be.equal(await wmusd.currentYieldShares());

            await expect(lmusd.connect(user1).unlock(tokenId)).to.be.rejectedWith(
                'ENotAuthorized()',
            );
            await expect(lmusd.connect(user0).unlock(tokenId)).to.be.rejectedWith(
                'ETokenIsStillLocked()',
            );

            // Jump to the future
            expect(await rebaseToken.sharesOf(user0)).to.be.equal(0);
            await time.increase(days(7));
            const balanceLMUSD = await lmusd['balanceOf(uint256)'](tokenId);
            // Note: has only one nft
            expect(await lmusd['balanceOf(address)'](user0)).to.be.equal(1);
            await lmusd.connect(user0).unlock(tokenId);
            expectEqual(await wmusd.currentYield(), 0n);
            expectEqual(await rebaseToken.sharesOf(user0), dedicatedShares + lockedShares, 18, 16);
            expectEqual(await rebaseToken.balanceOf(user0), balanceLMUSD, 18, 16);
        });

        it('Test add/disallow/delete period', async () => {
            const { rebaseToken, agent, user0, USDT, lmusd } =
                await loadFixture(deployNitrogenWithUSDT);

            // deposit 100 USDT
            const depositValue = 100_000_000n - 1n;
            // Grant user wallet with 100 USDT
            await grantERC20(user0, USDT, depositValue);
            // approve USDT to agent
            await USDT.connect(user0).approve(await agent.getAddress(), depositValue);
            // user0 calls requestDeposit on rebaseToken
            await rebaseToken.connect(user0).requestDeposit(depositValue, user0, user0);

            const mUSDAmount = await rebaseToken.balanceOf(user0);

            // user0 locks their tokens and gets NFT
            await rebaseToken.connect(user0).approve(lmusd, mUSDAmount);

            await expect(lmusd.deletePeriod(0, days(70))).to.be.rejectedWith(
                'EWrongIndexOrPeriod(',
            );
            await expect(lmusd.deletePeriod(days(70), 0)).to.be.rejectedWith(
                'EWrongIndexOrPeriod(',
            );
            await lmusd.deletePeriod(0, days(7));
            await lmusd.addPeriod(days(3), 10);
            await expect(lmusd.addPeriod(days(3), 10)).to.be.rejectedWith('EPeriodIsAlreadyExist(');

            await expect(lmusd.setAllowPeriod(days(1), false)).to.be.rejectedWith(
                'EPeriodDoesNotExist()',
            );
            await lmusd.setAllowPeriod(days(3), false);
            await expect(lmusd.connect(user0).lock(mUSDAmount, days(3))).to.be.rejectedWith(
                'ENotAllowedPeriod(',
            );

            await lmusd.setAllowPeriod(days(3), true);
            await expect(lmusd.setAllowPeriod(days(3), true)).to.be.rejectedWith('EAlreadySet()');
            await lmusd.connect(user0).lock(mUSDAmount, days(3));

            await expect(lmusd.deletePeriod(0, days(3))).to.be.rejectedWith('EPeriodHasShares(');

            const periods = await lmusd.getPeriods();
            expect(periods).to.be.deep.equal([BigInt(days(3))]);
        });

        it('Test auth', async () => {
            const { user0, lmusd } = await loadFixture(deployNitrogenWithUSDT);

            await expect(lmusd.connect(user0).addPeriod(days(1), 100)).to.be.rejectedWith(
                'OwnableUnauthorizedAccount(',
            );
            await expect(lmusd.connect(user0).setAllowPeriod(days(1), false)).to.be.rejectedWith(
                'OwnableUnauthorizedAccount(',
            );
            await expect(lmusd.connect(user0).deletePeriod(1, days(1))).to.be.rejectedWith(
                'OwnableUnauthorizedAccount(',
            );
        });

        it('Test lmUSD.sharesOf conner case', async () => {
            const { rebaseToken, agent, wmusd, user1, moleculaPool, USDT, lmusd } =
                await loadFixture(deployNitrogenWithUSDT);

            // user1 deposits 100 USDT
            const depositValue2 = 500_000_000n - 1n;
            // Grant user wallet with 100 USDT
            await grantERC20(user1, USDT, depositValue2);
            // approve USDT to agent
            await USDT.connect(user1).approve(await agent.getAddress(), depositValue2);
            // user1 calls requestDeposit on rebaseToken
            await rebaseToken.connect(user1).requestDeposit(depositValue2, user1, user1);

            // user1 converts mUSD -> wmUSD
            await rebaseToken.connect(user1).approve(wmusd.getAddress(), ethers.MaxUint256);
            await wmusd.connect(user1).wrap(await rebaseToken.balanceOf(user1));

            // Generate income
            const income = 5_000_000_000n;
            await grantERC20(moleculaPool.getAddress(), USDT, income);

            // Check user0's shares after generating income
            const { lockedShares, dedicatedShares } = await lmusd.sharesOf(123);
            expect(lockedShares).to.be.equal(0);
            expect(dedicatedShares).to.be.equal(0);
        });

        it('Test deploy', async () => {
            // Deploy lmUSD
            const signers = await ethers.getSigners();
            const randAddress = signers.at(0)!;
            const LMUSD = await ethers.getContractFactory('LMUSD');
            await expect(
                LMUSD.deploy(
                    ethMainnetBetaConfig.WMUSD_TOKEN_NAME,
                    ethMainnetBetaConfig.WMUSD_TOKEN_SYMBOL,
                    randAddress,
                    randAddress,
                    randAddress,
                    [days(7)],
                    [],
                ),
            ).to.be.rejectedWith('EBadLength()');
        });
    });
});
