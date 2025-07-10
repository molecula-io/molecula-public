/* eslint-disable camelcase, max-lines */
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';

import { INITIAL_SUPPLY } from '../../utils/Carbon';
import { deployNitrogenWithUSDT } from '../../utils/NitrogenCommon';
import { findRequestRedeemEvent } from '../../utils/event';
import { grantERC20 } from '../../utils/grant';

describe('Test SupplyManger yield', () => {
    describe('Test SupplyManager pool yield lock and out of gas distribution', () => {
        it('SupplyManager.distributeYield() out of gas for', async () => {
            const { moleculaPool, supplyManager, agent, USDT } =
                await loadFixture(deployNitrogenWithUSDT);

            const income = 250_000_000n;
            await grantERC20(await moleculaPool.poolKeeper(), USDT, income);

            // Create an array for users
            const users = [];
            const portionPerUser = 2n * 10n ** 15n; // Adjust portion as needed

            for (let i = 0; i < 500; i += 1) {
                const user = ethers.getAddress(`0x${i.toString(16).padStart(40, '0')}`); // Generate a new user account
                users.push({
                    party: user, // Use user address
                    portion: portionPerUser,
                });
            }

            // Distribute yield params
            const party = {
                parties: users,
                agent,
                ethValue: 0n,
            };
            // Distribute yield reverted with `out of gas` for array 500 users
            await expect(supplyManager.distributeYield([party], 4000)).to.be.reverted;
        });

        it('SupplyManager test lock yield', async () => {
            const { moleculaPool, supplyManager, rebaseToken, agent, user0, user1, caller, USDT } =
                await loadFixture(deployNitrogenWithUSDT);

            // generate income. make x2 share price.
            const income = 250_000_000n;
            // const income18 = income * 10n ** 12n;
            await grantERC20(await moleculaPool.poolKeeper(), USDT, income);
            expect(await supplyManager.totalSupply()).to.equal(INITIAL_SUPPLY);

            // user0 deposit 100 USDT
            const depositValue = 100_000_000n;
            // Grant user0 wallet with 100 USDT and 2 ETH
            await grantERC20(user0, USDT, depositValue);
            expect(await USDT.balanceOf(user0)).to.equal(depositValue);
            expect(await USDT.balanceOf(await moleculaPool.poolKeeper())).to.equal(income);

            // approve USDT to agent
            await USDT.connect(user0).approve(await agent.getAddress(), depositValue);

            // user0 calls requestDeposit on rebaseToken
            await rebaseToken.connect(user0).requestDeposit(depositValue, user0, user0);

            const shares = depositValue * 10n ** 12n;
            const value18 = depositValue * 10n ** 12n;
            expect(await USDT.balanceOf(user0)).to.equal(0);
            expect(await USDT.balanceOf(await moleculaPool.poolKeeper())).to.equal(income);
            expect(await supplyManager.totalSupply()).to.equal(INITIAL_SUPPLY * 2n);
            expect(await supplyManager.totalSharesSupply()).to.equal(INITIAL_SUPPLY + shares);
            expect(await moleculaPool.totalSupply()).to.equal(INITIAL_SUPPLY * 2n);
            expect(await rebaseToken.balanceOf(user0)).to.equal(value18);
            expect(await rebaseToken.sharesOf(user0)).to.equal(shares);

            // user1 deposit 100 USDT

            // Grant user1 wallet with 100 USDT and 2 ETH
            await grantERC20(user1, USDT, depositValue);
            expect(await USDT.balanceOf(user1)).to.equal(depositValue);
            expect(await USDT.balanceOf(await moleculaPool.poolKeeper())).to.equal(income);

            // approve USDT to agent
            await USDT.connect(user1).approve(await agent.getAddress(), depositValue);

            // user0 calls requestDeposit on rebaseToken
            await rebaseToken.connect(user1).requestDeposit(depositValue, user1, user1);
            expect(await USDT.balanceOf(user1)).to.equal(0);
            expect(await USDT.balanceOf(await moleculaPool.poolKeeper())).to.equal(income);
            expect(await supplyManager.totalSupply()).to.equal(INITIAL_SUPPLY * 3n);
            expect(await supplyManager.totalSharesSupply()).to.equal(INITIAL_SUPPLY + shares * 2n);
            expect(await moleculaPool.totalSupply()).to.equal(INITIAL_SUPPLY + shares * 2n);
            expect(await rebaseToken.balanceOf(user1)).to.equal(value18);
            expect(await rebaseToken.sharesOf(user1)).to.equal(shares);

            // distribute yield params
            const party_1 = {
                parties: [
                    {
                        party: user0,
                        portion: 500n * 10n ** 15n,
                    },
                    {
                        party: user1,
                        portion: 500n * 10n ** 15n,
                    },
                ],
                agent,
                ethValue: 0n,
            };
            // distribute yield
            await expect(supplyManager.distributeYield([party_1], 4000)).to.be.reverted;

            // user0 income request
            let tx = await rebaseToken.connect(user0).requestRedeem(shares * 100n, user0, user0);
            let eventData = await findRequestRedeemEvent(tx);
            const ownerOperationId = eventData.operationId;

            // user1 income request
            tx = await rebaseToken.connect(user1).requestRedeem(shares * 100n, user1, user1);
            eventData = await findRequestRedeemEvent(tx);
            const user1OperationId = eventData.operationId;

            const ownerIncome =
                (await supplyManager.redeemRequests(ownerOperationId)).value - depositValue;
            const user1Income =
                (await supplyManager.redeemRequests(user1OperationId)).value - depositValue;

            // 40% of income kept for a company
            expect(ownerIncome + user1Income).to.be.equal(0);

            // caller deposit 100 USDT

            // Grant user1 wallet with 100 USDT
            await grantERC20(caller, USDT, depositValue);
            expect(await USDT.balanceOf(caller)).to.equal(depositValue);
            expect(await USDT.balanceOf(await moleculaPool.poolKeeper())).to.equal(income);

            // approve USDT to agent
            await USDT.connect(caller).approve(await agent.getAddress(), depositValue);

            // user0 calls requestDeposit on rebaseToken
            await rebaseToken.connect(caller).requestDeposit(depositValue, caller, caller);

            expect(await USDT.balanceOf(caller)).to.equal(0);
            expect(await USDT.balanceOf(await moleculaPool.poolKeeper())).to.equal(income);
            expect(await supplyManager.totalSupply()).to.equal(INITIAL_SUPPLY * 2n);
            expect(await supplyManager.totalSharesSupply()).to.equal(INITIAL_SUPPLY + shares * 1n);
            expect(await moleculaPool.totalSupply()).to.equal(INITIAL_SUPPLY + value18);
            expect(await rebaseToken.balanceOf(caller)).to.equal(value18);
            expect(await rebaseToken.sharesOf(caller)).to.equal(shares);

            // distribute yield params
            const party_2 = {
                parties: [
                    {
                        party: caller,
                        portion: 10n ** 18n,
                    },
                ],
                agent,
                ethValue: 0n,
            };
            // distribute yield revert
            await expect(supplyManager.distributeYield([party_2], 4000)).to.be.reverted;

            // caller income request
            tx = await rebaseToken.connect(caller).requestRedeem(shares * 100n, caller, caller);
            eventData = await findRequestRedeemEvent(tx);
            const callerOperationId = eventData.operationId;

            // caller income zero locked USDT yield balance kept
            const callerIncome =
                (await supplyManager.redeemRequests(callerOperationId)).value - depositValue;
            expect(callerIncome).to.be.equal(0);

            // second caller deposit 100 USDT

            // Grant user1 wallet with 100 USDT
            await grantERC20(caller, USDT, depositValue);
            expect(await USDT.balanceOf(caller)).to.equal(depositValue);
            expect(await USDT.balanceOf(await moleculaPool.poolKeeper())).to.equal(income);

            // approve USDT to agent
            await USDT.connect(caller).approve(await agent.getAddress(), depositValue);

            // user0 calls requestDeposit on rebaseToken
            await rebaseToken.connect(caller).requestDeposit(depositValue, caller, caller);

            expect(await USDT.balanceOf(caller)).to.equal(0);
            expect(await USDT.balanceOf(await moleculaPool.poolKeeper())).to.equal(income);
            expect(await supplyManager.totalSupply()).to.equal(INITIAL_SUPPLY * 2n);
            expect(await supplyManager.totalSharesSupply()).to.equal(INITIAL_SUPPLY + shares * 1n);
            expect(await moleculaPool.totalSupply()).to.equal(INITIAL_SUPPLY + value18);
            expect(await rebaseToken.balanceOf(caller)).to.equal(value18);
            expect(await rebaseToken.sharesOf(caller)).to.equal(shares);

            // distribute yield revert
            await expect(supplyManager.distributeYield([party_2], 4000)).to.be.reverted;
            // caller income request
            tx = await rebaseToken.connect(caller).requestRedeem(shares * 100n, caller, caller);
            eventData = await findRequestRedeemEvent(tx);
            const callerOperationId_2 = eventData.operationId;

            // caller income again zero locked USDT yield balance kept
            const callerIncome_2 =
                (await supplyManager.redeemRequests(callerOperationId_2)).value - depositValue;
            expect(callerIncome_2).to.be.equal(0);
        });
    });
});
