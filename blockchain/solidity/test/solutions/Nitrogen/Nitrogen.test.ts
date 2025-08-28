/* eslint-disable camelcase, max-lines, no-await-in-loop, no-restricted-syntax, no-bitwise, no-plusplus */
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';

import { ethMainnetBetaConfig } from '../../../configs';

import { INITIAL_SUPPLY } from '../../utils/Carbon';
import { getEthena, grantStakedUSDE, grantUSDe } from '../../utils/Common';

import {
    deployMoleculaPool,
    deployNitrogenWithStakedUSDe,
    deployNitrogenWithUSDT,
    deployNitrogenWithUSDTAndOldPool,
    getRidOf,
    initNitrogenAndRequestDeposit,
    initNitrogenForPause,
} from '../../utils/NitrogenCommon';
import { findRequestRedeemEvent } from '../../utils/event';
import { grantERC20 } from '../../utils/grant';
import { expectEqualBigInt } from '../../utils/math';

describe('Test Nitrogen solution', () => {
    describe('General solution tests', () => {
        it('Should set the right owner', async () => {
            const { moleculaPool, supplyManager, agent, rebaseToken, poolOwner, rebaseTokenOwner } =
                await loadFixture(deployNitrogenWithUSDT);

            expect(await moleculaPool.owner()).to.equal(await poolOwner.getAddress());
            expect(await supplyManager.owner()).to.equal(await poolOwner.getAddress());
            expect(await agent.owner()).to.equal(await poolOwner.getAddress());
            expect(await rebaseToken.owner()).to.equal(rebaseTokenOwner.address);
            expect(await moleculaPool.totalSupply()).to.equal(100n * 10n ** 18n);
            expect(await supplyManager.totalSupply()).to.equal(100n * 10n ** 18n);
        });

        it('Deposit and Income Flow', async () => {
            const {
                moleculaPool,
                supplyManager,
                rebaseToken,
                agent,
                user0,
                user1,
                malicious,
                USDT,
            } = await loadFixture(deployNitrogenWithUSDT);
            // deposit 100 USDT
            const depositValue = 100_000_000n;
            // Grant user wallet with 100 USDT
            await grantERC20(user0, USDT, depositValue);
            expect(await USDT.balanceOf(user0)).to.equal(depositValue);
            expect(await USDT.balanceOf(await moleculaPool.getAddress())).to.equal(0n);
            expect(await USDT.balanceOf(await moleculaPool.poolKeeper())).to.equal(0n);

            // approve USDT to agent
            await USDT.connect(user0).approve(await agent.getAddress(), depositValue);

            // user0 calls requestDeposit on rebaseToken
            await rebaseToken.connect(user0).requestDeposit(depositValue, user0, user0);
            const shares = depositValue * 10n ** 12n;
            expect(await USDT.balanceOf(user0)).to.equal(0);
            expect(await USDT.balanceOf(moleculaPool.getAddress())).to.equal(depositValue);
            expect(await supplyManager.totalSupply()).to.equal(INITIAL_SUPPLY * 2n);
            expect(await supplyManager.totalSharesSupply()).to.equal(INITIAL_SUPPLY * 2n);
            expect(await rebaseToken.balanceOf(user0)).to.equal(depositValue * 10n ** 12n);
            expect(await rebaseToken.sharesOf(user0)).to.equal(shares);

            // Generate income. Make x2 share price.
            // User gets 40% of the income
            const income = 500_000_000n;
            await grantERC20(moleculaPool.getAddress(), USDT, income);
            expect(await moleculaPool.totalSupply()).to.equal(INITIAL_SUPPLY * 7n);
            expect(await supplyManager.totalSupply()).to.equal(INITIAL_SUPPLY * 4n);
            expect(await supplyManager.totalSharesSupply()).to.equal(INITIAL_SUPPLY * 2n);
            expect(await rebaseToken.balanceOf(user0)).to.equal(depositValue * 2n * 10n ** 12n);
            expect(await rebaseToken.sharesOf(user0)).to.equal(shares);

            // Grant user1 wallet with 100 USDT and 2 ETH
            await grantERC20(user1, USDT, depositValue);
            expect(await USDT.balanceOf(user1)).to.equal(depositValue);
            expect(await supplyManager.totalDepositedSupply()).to.equal(INITIAL_SUPPLY * 2n);

            // approve USDT to agent
            await USDT.connect(user1).approve(await agent.getAddress(), depositValue);

            // user0 calls requestDeposit on rebaseToken
            await rebaseToken.connect(user1).requestDeposit(depositValue, user1, user1);
            const secondShares = (depositValue * 10n ** 12n) / 2n;
            expect(await USDT.balanceOf(await agent.getAddress())).to.equal(0);
            expect(await USDT.balanceOf(await moleculaPool.getAddress())).to.equal(
                depositValue * 2n + income,
            );
            expect(await supplyManager.totalSupply()).to.equal(INITIAL_SUPPLY * 5n);
            expect(await supplyManager.totalSharesSupply()).to.equal(
                INITIAL_SUPPLY + shares + secondShares,
            );
            expect(await rebaseToken.balanceOf(user0)).to.equal(depositValue * 2n * 10n ** 12n);
            expect(await rebaseToken.sharesOf(user0)).to.equal(shares);
            expect(await rebaseToken.balanceOf(user1)).to.equal(depositValue * 10n ** 12n);
            expect(await rebaseToken.sharesOf(user1)).to.equal(secondShares);

            expect(await moleculaPool.totalSupply()).to.equal(INITIAL_SUPPLY * 8n);
            expect(await supplyManager.totalDepositedSupply()).to.equal(INITIAL_SUPPLY * 3n);
            // check molecula pool
            expect(await moleculaPool.totalSupply()).to.equal(INITIAL_SUPPLY * 8n);
            expect(await supplyManager.totalSupply()).to.equal(
                (await supplyManager.totalSharesSupply()) * 2n,
            );

            // user asks for redeem
            const redeemShares = await rebaseToken.sharesOf(user0);
            let tx = await rebaseToken.connect(user0).requestRedeem(redeemShares, user0, user0);
            let eventData = await findRequestRedeemEvent(tx);

            const { operationId } = eventData;
            expect(eventData.agentAddress).to.equal(await agent.getAddress());
            expect(eventData.redeemShares).to.equal(redeemShares);
            expect(eventData.redeemValue).to.equal(depositValue * 2n);
            const { redeemValue } = eventData;
            expect(await rebaseToken.balanceOf(user0)).to.equal(0);
            expect(await rebaseToken.sharesOf(user0)).to.equal(0);
            expect(await rebaseToken.balanceOf(user1)).to.equal(depositValue * 10n ** 12n);
            expect(await rebaseToken.sharesOf(user1)).to.equal(secondShares);
            expect(await moleculaPool.totalSupply()).to.equal(INITIAL_SUPPLY * 6n);
            expect((await moleculaPool.poolMap(USDT)).valueToRedeem).to.equal(
                (INITIAL_SUPPLY * 2n) / 10n ** 12n,
            );
            expect(await supplyManager.totalSupply()).to.equal(420n * 10n ** 18n);
            expect(await supplyManager.totalSharesSupply()).to.equal(
                INITIAL_SUPPLY + secondShares + 60n * 10n ** 18n,
            );
            expect(await supplyManager.totalSupply()).to.equal(
                (await supplyManager.totalSharesSupply()) * 2n,
            );
            expect(await supplyManager.totalDepositedSupply()).to.equal(INITIAL_SUPPLY * 3n);

            // user1 ask for redeem
            const redeemShares_1 = await rebaseToken.sharesOf(user1);
            tx = await rebaseToken.connect(user1).requestRedeem(redeemShares_1, user1, user1);
            eventData = await findRequestRedeemEvent(tx);

            const operationId_1 = eventData.operationId;
            expect(eventData.agentAddress).to.equal(await agent.getAddress());
            expect(eventData.redeemShares).to.equal(redeemShares_1);
            expect(eventData.redeemValue).to.equal(depositValue);
            const redeemValue_1 = eventData.redeemValue;
            expect(await rebaseToken.balanceOf(user1)).to.equal(0);
            expect(await rebaseToken.sharesOf(user1)).to.equal(0);
            expect(await supplyManager.totalSupply()).to.equal(362857142857142857142n);
            expect(await supplyManager.totalSharesSupply()).to.equal(181428571428571428571n);
            expect(await supplyManager.totalSupply()).to.equal(
                (await supplyManager.totalSharesSupply()) * 2n,
            );

            // check molecula pool
            expect(await moleculaPool.totalSupply()).to.equal(INITIAL_SUPPLY * 5n);
            expect(await USDT.balanceOf(moleculaPool.getAddress())).to.equal(700_000_000n);
            const DAI = await ethers.getContractAt('IERC20', ethMainnetBetaConfig.DAI_ADDRESS);
            expect(await DAI.balanceOf(moleculaPool.getAddress())).to.equal(INITIAL_SUPPLY);

            // redeem to user and user1

            // user0 call redeem
            await expect(
                moleculaPool.connect(malicious).redeem([operationId, 123]),
            ).to.be.rejectedWith('EBadOperationStatus()');
            tx = await moleculaPool.connect(malicious).redeem([operationId, operationId_1]);
            await ethers.provider.getTransactionReceipt(tx.hash);
            // Check event
            await expect(tx).to.emit(rebaseToken, 'Redeem');
            // check molecula pool
            expect(await moleculaPool.totalSupply()).to.equal(INITIAL_SUPPLY * 5n);
            expect(await USDT.balanceOf(await moleculaPool.getAddress())).to.equal(400_000_000n);
            expect(await DAI.balanceOf(await moleculaPool.getAddress())).to.equal(INITIAL_SUPPLY);
            // check redeem requests
            expect((await rebaseToken.redeemRequests(operationId)).status).to.equal(4);
            expect((await rebaseToken.redeemRequests(operationId)).val).to.equal(redeemValue);
            expect(await USDT.balanceOf(agent.getAddress())).to.equal(redeemValue + redeemValue_1);
            expect(await USDT.balanceOf(user0)).to.equal(0n);
            expect((await rebaseToken.redeemRequests(operationId_1)).status).to.equal(4);
            expect((await rebaseToken.redeemRequests(operationId_1)).val).to.equal(redeemValue_1);
            expect(await USDT.balanceOf(user1)).to.equal(0n);
            // check supply manager
            expect(await supplyManager.totalSupply()).to.equal(362857142857142857142n);
            expect(await supplyManager.totalSharesSupply()).to.equal(181428571428571428571n);
            expect(await supplyManager.totalSupply()).to.equal(
                (await supplyManager.totalSharesSupply()) * 2n,
            );

            // anyone calls confirmRedeem for user
            await rebaseToken.connect(user1).confirmRedeem(operationId);
            expect((await rebaseToken.redeemRequests(operationId)).status).to.equal(2);
            expect((await rebaseToken.redeemRequests(operationId)).val).to.equal(redeemValue);
            expect(await USDT.balanceOf(agent.getAddress())).to.equal(redeemValue_1);
            expect(await USDT.balanceOf(user0)).to.equal(redeemValue);

            // anyone calls confirmRedeem for user1
            await rebaseToken.connect(user1).confirmRedeem(operationId_1);
            expect((await rebaseToken.redeemRequests(operationId_1)).status).to.equal(2);
            expect((await rebaseToken.redeemRequests(operationId_1)).val).to.equal(redeemValue_1);
            expect(await USDT.balanceOf(agent.getAddress())).to.equal(0);
            expect(await USDT.balanceOf(user1)).to.equal(redeemValue_1);

            // check supply manager
            expect(await supplyManager.totalSupply()).to.equal(362857142857142857142n);
            expect(await supplyManager.totalSharesSupply()).to.equal(181428571428571428571n);
        });

        async function depositAndRequestRedeem() {
            const {
                moleculaPool,
                rebaseToken,
                agent,
                user0,
                malicious,
                USDT,
                poolOwner,
                poolKeeper,
            } = await loadFixture(deployNitrogenWithUSDT);
            // deposit 100 USDT
            const depositValue = 100n * 10n ** 6n - 1n;
            // Grant user wallet with 100 USDT
            await grantERC20(user0, USDT, depositValue);

            // approve USDT to agent
            await USDT.connect(user0).approve(await agent.getAddress(), depositValue);
            // user0 calls requestDeposit on rebaseToken
            await rebaseToken.connect(user0).requestDeposit(depositValue, user0, user0);

            // user asks for redeem
            const redeemShares = (await rebaseToken.sharesOf(user0)) - 1n;
            const tx = await rebaseToken.connect(user0).requestRedeem(redeemShares, user0, user0);
            const eventData = await findRequestRedeemEvent(tx);
            const { operationId, redeemValue } = eventData;
            expect(redeemValue).to.be.equal(depositValue - 1n);
            expect((await moleculaPool.poolMap(USDT)).valueToRedeem).to.be.equal(depositValue - 1n);
            return {
                moleculaPool,
                operationId,
                malicious,
                USDT,
                rebaseToken,
                depositValue,
                user0,
                poolOwner,
                poolKeeper,
            };
        }

        it('Deposit and Redeem Flow without income', async () => {
            const { moleculaPool, operationId, malicious, USDT, rebaseToken, depositValue, user0 } =
                await loadFixture(depositAndRequestRedeem);

            // redeem
            await moleculaPool.connect(malicious).redeem([operationId]);
            expect((await moleculaPool.poolMap(USDT)).valueToRedeem).to.be.equal(0n);

            // anyone calls confirmRedeem for user
            await rebaseToken.connect(malicious).confirmRedeem(operationId);
            expect(await USDT.balanceOf(user0)).to.be.equal(depositValue - 1n);
        });

        it('Test remove with valueToRedeem', async () => {
            const { moleculaPool, malicious, USDT, poolOwner, poolKeeper } =
                await loadFixture(depositAndRequestRedeem);

            // Send all USDT to random address and try to remove USDT token.
            await getRidOf(moleculaPool, poolOwner, USDT, malicious.address, poolKeeper);
            await expect(moleculaPool.removeToken(USDT)).to.be.rejectedWith(
                'ENotZeroValueToRedeemOfRemovedToken()',
            );
        });

        it('Test requestDeposit for user0 (not for msg.sender)', async () => {
            const {
                moleculaPool,
                rebaseToken,
                agent,
                user0,
                caller,
                malicious,
                controller,
                randAccount,
                USDT,
            } = await loadFixture(deployNitrogenWithUSDT);
            // deposit 100 USDT
            const depositValue = 100_000_000n;
            // Grant userAgent wallet with 100 USDT and 2 ETH
            await grantERC20(user0, USDT, depositValue);
            expect(await USDT.balanceOf(user0)).to.equal(depositValue);
            expect(await USDT.balanceOf(await moleculaPool.poolKeeper())).to.equal(0n);

            // Malicious user failed to make requestDeposit
            await expect(
                rebaseToken.connect(malicious).requestDeposit(depositValue, user0, user0),
            ).to.be.rejectedWith('EBadOwner');
            expect(await rebaseToken.sharesOf(malicious)).to.equal(0);

            // Owner approves USDT for agent
            await USDT.connect(user0).approve(await agent.getAddress(), depositValue);
            // Controller is caller operator
            await rebaseToken.connect(user0).setOperator(caller, true);
            expect(await rebaseToken.isOperator(user0, caller)).to.equal(true);

            // Owner calls requestDeposit on rebaseToken
            await rebaseToken.connect(caller).requestDeposit(depositValue, controller, user0);
            const shares = depositValue * 10n ** 12n;
            expect(await USDT.balanceOf(user0)).to.equal(0);
            expect(await rebaseToken.sharesOf(caller)).to.equal(0);
            expect(await rebaseToken.sharesOf(user0)).to.equal(0);
            expect(await rebaseToken.sharesOf(controller)).to.equal(shares);

            // Controller grants mUSD to user0
            await rebaseToken.connect(controller).transfer(user0, shares);
            expect(await rebaseToken.sharesOf(controller)).to.equal(0);
            expect(await rebaseToken.sharesOf(user0)).to.equal(shares);

            // Caller asks for redeem
            const redeemShares = await rebaseToken.sharesOf(user0);
            const tx = await rebaseToken
                .connect(caller)
                .requestRedeem(redeemShares, controller, user0);
            const eventData = await findRequestRedeemEvent(tx);

            const { operationId } = eventData;
            expect(eventData.agentAddress).to.equal(await agent.getAddress());
            expect(eventData.redeemShares).to.equal(redeemShares);
            expect(eventData.redeemValue).to.equal(depositValue);
            expect(await rebaseToken.balanceOf(user0)).to.equal(0);
            expect(await rebaseToken.sharesOf(caller)).to.equal(0);
            expect(await USDT.balanceOf(caller)).to.equal(0);
            expect(await USDT.balanceOf(user0)).to.equal(0);

            await moleculaPool.connect(randAccount).redeem([operationId]);
            // Anyone can call confirmRedeem
            await rebaseToken.connect(malicious).confirmRedeem(operationId);

            // Controller got their USDT
            expect(await USDT.balanceOf(controller)).to.equal(depositValue);
            expect(await USDT.balanceOf(caller)).to.equal(0);
            expect(await USDT.balanceOf(user0)).to.equal(0);
        });

        it('Distribute yield', async () => {
            const { moleculaPool, supplyManager, agent, user1, rebaseToken, malicious } =
                await loadFixture(deployNitrogenWithUSDT);

            const val = 100n * 10n ** 18n;
            expect(await supplyManager.totalSupply()).to.equal(val);
            expect(await supplyManager.totalSharesSupply()).to.equal(val);
            const DAI = await ethers.getContractAt('IERC20', ethMainnetBetaConfig.DAI_ADDRESS);

            // generate income
            await grantERC20(await moleculaPool.getAddress(), DAI, val);

            expect(await supplyManager.totalSupply()).to.equal(140n * 10n ** 18n);
            expect(await supplyManager.totalSharesSupply()).to.equal(val);

            // Get user1 balance
            const balance = await rebaseToken.balanceOf(user1);
            expect(balance).to.equal(0n);

            // distribute yield params
            const party = {
                parties: [
                    {
                        party: user1,
                        portion: 10n ** 18n,
                    },
                ],
                agent,
                ethValue: 0n,
            };
            // distribute yield
            await supplyManager.distributeYield([party], 5000);

            expect(await supplyManager.apyFormatter()).to.equal(5000);
            expect(await rebaseToken.balanceOf(user1)).to.equal(59999999999999999999n);
            expect(await supplyManager.totalSupply()).to.equal(200n * 10n ** 18n);
            expect(await supplyManager.totalSharesSupply()).to.equal(142857142857142857142n);

            // Try again
            await expect(supplyManager.distributeYield([party], 5000)).to.be.rejectedWith(
                'ENoRealYield()',
            );

            // Try from malicious address
            await expect(agent.connect(malicious).distribute([], [])).to.be.rejectedWith(
                'EBadSender()',
            );

            // Try with a wrong agent
            const maliciousParty = {
                parties: [
                    {
                        party: user1,
                        portion: 10n ** 18n,
                    },
                ],
                agent: malicious.address,
                ethValue: 0n,
            };
            await expect(supplyManager.distributeYield([maliciousParty], 0)).to.be.rejectedWith(
                'EWrongAgent()',
            );

            // Try with wrong agents
            const maliciousParties = [
                {
                    parties: [
                        {
                            party: user1,
                            portion: 250n * 10n ** 15n,
                        },
                    ],
                    agent: malicious.address,
                    ethValue: 0n,
                },
                {
                    parties: [
                        {
                            party: user1,
                            portion: 250n * 10n ** 15n,
                        },
                    ],
                    agent: malicious.address,
                    ethValue: 0n,
                },
                {
                    parties: [
                        {
                            party: user1,
                            portion: 250n * 10n ** 15n,
                        },
                    ],
                    agent: malicious.address,
                    ethValue: 0n,
                },
                {
                    parties: [
                        {
                            party: user1,
                            portion: 250n * 10n ** 15n,
                        },
                    ],
                    agent: malicious.address,
                    ethValue: 0n,
                },
            ];
            await expect(supplyManager.distributeYield(maliciousParties, 0)).to.be.rejectedWith(
                'EWrongAgent()',
            );
        });
    });

    describe('Test special cases', () => {
        it('Should be MOLECULA_POOL.totalSupply > 0', async () => {
            const { moleculaPool, poolOwner } = await loadFixture(deployMoleculaPool);

            // deploy supply manager
            const SupplyManager = await ethers.getContractFactory('SupplyManager');
            // Failed to deploy supply manager
            await expect(
                SupplyManager.connect(poolOwner).deploy(
                    poolOwner.address,
                    poolOwner.address,
                    await moleculaPool.getAddress(),
                    4000,
                ),
            ).to.be.rejectedWith('EZeroTotalSupply()');
        });

        it('Check push invalid token', async () => {
            const { moleculaPool, poolOwner } = await loadFixture(deployNitrogenWithStakedUSDe);

            // It's not a smart-contract
            await expect(moleculaPool.addToken(poolOwner)).to.be.rejectedWith('ENotContract');
            // It's not a ERC-20 token
            await expect(moleculaPool.addToken(moleculaPool)).to.be.rejectedWith(
                'ENotERC20PoolToken()',
            );
        });

        it('Check duplicated pools', async () => {
            const { moleculaPool, poolOwner } = await loadFixture(deployMoleculaPool);
            const token = ethMainnetBetaConfig.USDT_ADDRESS;
            const token2 = ethMainnetBetaConfig.USDC_ADDRESS;

            await moleculaPool.connect(poolOwner).addToken(token);
            await expect(moleculaPool.connect(poolOwner).addToken(token)).to.be.rejectedWith(
                'EDuplicatedToken()',
            );

            // Check that pool is empty
            await expect(moleculaPool.connect(poolOwner).removeToken(token2)).to.be.rejectedWith(
                'ETokenNotExist()',
            );
            await moleculaPool.connect(poolOwner).removeToken(token);
            expect((await moleculaPool.connect(poolOwner).getTokenPool()).length).to.be.equal(0);

            const USDT = await ethers.getContractAt('IERC20', token);
            await moleculaPool.connect(poolOwner).addToken(USDT);
            await grantERC20(moleculaPool, USDT, 100_000_000n);
            await moleculaPool.connect(poolOwner).removeToken(USDT);
            expect(await USDT.balanceOf(poolOwner)).to.be.equal(100_000_000n);
        });

        it('Test remove tokens', async () => {
            const { moleculaPool, poolOwner } = await loadFixture(deployMoleculaPool);
            const token = ethMainnetBetaConfig.USDT_ADDRESS;
            const token2 = ethMainnetBetaConfig.USDC_ADDRESS;
            const token3 = ethMainnetBetaConfig.USDE_ADDRESS;

            await moleculaPool.connect(poolOwner).addToken(token);
            await moleculaPool.connect(poolOwner).addToken(token2);
            await moleculaPool.connect(poolOwner).addToken(token3);
            // in pool: token, token2, token3
            await moleculaPool.connect(poolOwner).removeToken(token);
            expect((await moleculaPool.connect(poolOwner).poolMap(token)).tokenType).to.be.equal(0);
            // in pool: token2, token3
            for (const t of [token2, token3]) {
                const { arrayIndex } = await moleculaPool.connect(poolOwner).poolMap(t);
                const res = await moleculaPool.connect(poolOwner).pool(arrayIndex);
                expect(t.toLocaleLowerCase()).to.be.equal(res.token.toLocaleLowerCase());
            }
        });

        it('Check duplicated pools 4626', async () => {
            const { moleculaPool, poolOwner } = await loadFixture(deployMoleculaPool);

            const { susde, usde, usdeMinter } = await getEthena();

            await moleculaPool.connect(poolOwner).addToken(susde);
            await expect(moleculaPool.connect(poolOwner).addToken(susde)).to.be.rejectedWith(
                'EDuplicatedToken()',
            );

            await expect(
                moleculaPool.connect(poolOwner).removeToken(ethMainnetBetaConfig.USDC_ADDRESS),
            ).to.be.rejectedWith('ETokenNotExist()');
            await moleculaPool.connect(poolOwner).removeToken(susde);
            await expect(moleculaPool.connect(poolOwner).pool(0)).to.be.rejected;

            await moleculaPool.connect(poolOwner).addToken(susde);
            await grantStakedUSDE(moleculaPool, 100n * 10n ** 18n, usde, susde, usdeMinter);
            await moleculaPool.connect(poolOwner).removeToken(susde);
            expect(await susde.balanceOf(poolOwner)).to.be.equal(100n * 10n ** 18n);
        });

        it('Check SupplyManager.apyFormatter', async () => {
            const { moleculaPool, poolOwner, USDT } = await loadFixture(deployMoleculaPool);
            await moleculaPool.connect(poolOwner).addToken(USDT);
            await grantERC20(await moleculaPool.getAddress(), USDT, 100_000_000n);

            const SupplyManager = await ethers.getContractFactory('SupplyManager');
            const APY_FACTOR = 10_000;
            const deployTx = SupplyManager.connect(poolOwner).deploy(
                poolOwner.address,
                poolOwner.address,
                await moleculaPool.getAddress(),
                APY_FACTOR + 1,
            );
            await expect(deployTx).to.be.rejectedWith('EInvalidAPY');

            const supplyManager = await SupplyManager.connect(poolOwner).deploy(
                poolOwner.address,
                poolOwner.address,
                await moleculaPool.getAddress(),
                4000,
            );
            const tx = supplyManager.connect(poolOwner).distributeYield([], APY_FACTOR + 1);
            await expect(tx).to.be.rejectedWith('EInvalidAPY');
        });

        it('MoleculaPool should accept ERC4626', async () => {
            const { usde, susde, usdeMinter } = await getEthena();
            const {
                moleculaPool,
                agent,
                rebaseToken,
                supplyManager,
                user1,
                malicious,
                randAccount,
            } = await loadFixture(deployNitrogenWithStakedUSDe);

            // deposit 123 stakedUSDe
            const susdeUserDeposit = 123n * 10n ** (await susde.decimals());
            await grantStakedUSDE(user1.address, susdeUserDeposit, usde, susde, usdeMinter);
            expect(await susde.balanceOf(user1)).to.equal(susdeUserDeposit);
            expect(await susde.balanceOf(await moleculaPool.getAddress())).to.equal(0n);
            expect(await susde.balanceOf(await moleculaPool.poolKeeper())).to.equal(0n);

            // Let's increase total USDe (that locked by StakedUSDe) by 2 times!
            const totalLockedUsde = await susde.totalAssets();
            await grantUSDe(await susde.getAddress(), usde, usdeMinter, totalLockedUsde);
            // Shares (sUSDe) is not changed
            expect(await susde.balanceOf(user1.getAddress())).to.be.equal(susdeUserDeposit);
            // Assets (USDe) is increased
            expect(await susde.convertToAssets(susdeUserDeposit)).to.be.greaterThan(
                susdeUserDeposit,
            );

            // User deposits their tokens
            const startTotalDepositedSupply = await supplyManager.totalDepositedSupply();
            // Approve sUSDe tokens to agent
            await susde.connect(user1).approve(await agent.getAddress(), susdeUserDeposit);
            // user0 calls requestDeposit on rebaseToken
            await rebaseToken.connect(user1).requestDeposit(susdeUserDeposit, user1, user1);

            // Print stake
            const totalDepositedSupply = await supplyManager.totalDepositedSupply();
            const deltaTotalDeposit = totalDepositedSupply - startTotalDepositedSupply;
            expect(deltaTotalDeposit).to.be.greaterThan(susdeUserDeposit);

            // User calls rebaseToken.requestRedeem
            const redeemShares = await rebaseToken.sharesOf(user1);
            const tx = await rebaseToken.connect(user1).requestRedeem(redeemShares, user1, user1);
            const erc4626ValueToRedeem = (await moleculaPool.totalPoolsSupplyAndRedeem())[1];
            // erc4626ValueToRedeem > deltaTotalDeposit because sUSDe is always increasing their value.
            expect(erc4626ValueToRedeem).to.be.greaterThan(deltaTotalDeposit);
            const eventData = await findRequestRedeemEvent(tx);

            const { operationId } = eventData;
            expect(eventData.agentAddress).to.equal(await agent.getAddress());
            expect(eventData.redeemShares).to.equal(deltaTotalDeposit);
            // It should be equal, but we store mUSD (kind of USDe) and sUSDe cost is always increasing.
            expect(eventData.redeemValue).to.be.lessThan(susdeUserDeposit);

            // User get back theis tokens
            await moleculaPool.connect(randAccount).redeem([operationId]);
            // `valueToRedeem` must be 0, but we have some rounding error
            expect((await moleculaPool.poolMap(susde)).valueToRedeem).to.be.equal(0);
            await rebaseToken.connect(malicious).confirmRedeem(operationId);
            expectEqualBigInt(
                await susde.balanceOf(user1.getAddress()),
                susdeUserDeposit,
                await susde.decimals(),
                5n,
            );
        });

        it('Test white list', async () => {
            const { moleculaPool, poolOwner, malicious, approveSelector } =
                await loadFixture(deployMoleculaPool);

            // Test deleteFromWhiteList
            expect(
                await moleculaPool
                    .connect(poolOwner)
                    .isWhitelistedSignature(ethMainnetBetaConfig.USDT_ADDRESS, approveSelector),
            ).to.be.true;
            await moleculaPool
                .connect(poolOwner)
                .deleteFromWhiteList(ethMainnetBetaConfig.USDT_ADDRESS, approveSelector);
            await expect(
                moleculaPool
                    .connect(poolOwner)
                    .deleteFromWhiteList(ethMainnetBetaConfig.USDT_ADDRESS, approveSelector),
            ).to.be.rejectedWith('ENotPresentInWhiteList()');

            // Test addInWhiteList
            expect(
                await moleculaPool
                    .connect(poolOwner)
                    .isWhitelistedSignature(ethMainnetBetaConfig.USDT_ADDRESS, approveSelector),
            ).to.be.false;
            await moleculaPool
                .connect(poolOwner)
                .addInWhiteList(ethMainnetBetaConfig.USDT_ADDRESS, approveSelector);
            expect(
                await moleculaPool
                    .connect(poolOwner)
                    .isWhitelistedSignature(ethMainnetBetaConfig.USDT_ADDRESS, approveSelector),
            ).to.be.true;
            await expect(
                moleculaPool
                    .connect(poolOwner)
                    .addInWhiteList(ethMainnetBetaConfig.USDT_ADDRESS, approveSelector),
            ).to.be.rejectedWith('EAlreadyAdded');

            // Test wrong user0
            await expect(
                moleculaPool
                    .connect(malicious)
                    .addInWhiteList(ethMainnetBetaConfig.USDT_ADDRESS, approveSelector),
            ).to.be.rejectedWith('OwnableUnauthorizedAccount');
            await expect(
                moleculaPool
                    .connect(malicious)
                    .deleteFromWhiteList(ethMainnetBetaConfig.USDT_ADDRESS, approveSelector),
            ).to.be.rejectedWith('OwnableUnauthorizedAccount');
        });

        it('Test execute', async () => {
            const { moleculaPool, randAccount, poolOwner, USDT, approveSelector } =
                await loadFixture(deployNitrogenWithUSDT);
            const keeperSigner = await ethers.getImpersonatedSigner(
                await moleculaPool.poolKeeper(),
            );
            const encodedApprove = USDT.interface.encodeFunctionData('approve', [
                randAccount.address,
                100500n,
            ]);
            const encodedBalanceOf = USDT.interface.encodeFunctionData('balanceOf', [
                randAccount.address,
            ]);
            await expect(
                moleculaPool.connect(keeperSigner).execute(USDT.getAddress(), encodedBalanceOf),
            ).to.be.rejectedWith('ENotPresentInWhiteList()');
            await expect(
                moleculaPool.connect(keeperSigner).execute(USDT.getAddress(), encodedApprove),
            ).to.be.rejectedWith('ENotInWhiteListSpender()');

            await moleculaPool.setSpenderInWhiteList(randAccount, true);
            await expect(
                moleculaPool
                    .connect(keeperSigner)
                    .execute(USDT.getAddress(), encodedApprove, { value: 1 }),
            ).to.be.rejectedWith('EMsgValueIsNotZero()');
            await moleculaPool
                .connect(poolOwner)
                .addInWhiteList(randAccount.address, approveSelector);
            await moleculaPool.connect(keeperSigner).execute(USDT.getAddress(), encodedApprove);

            expect(
                await USDT.allowance(moleculaPool.getAddress(), randAccount.address),
            ).to.be.equal(100500n);

            const testSeqnoFactory = await ethers.getContractFactory('TestSeqno');
            const testSeqno = await testSeqnoFactory.connect(randAccount).deploy();
            const encodedIncAndPay = testSeqno.interface.encodeFunctionData('incAndPay', [13n]);
            await moleculaPool
                .connect(poolOwner)
                .addInWhiteList(testSeqno, testSeqno.interface.getFunction('incAndPay').selector);
            await moleculaPool
                .connect(keeperSigner)
                .execute(testSeqno.getAddress(), encodedIncAndPay, { value: 124 });
            expect(await testSeqno.seqno()).to.be.equal(13n);
            expect(await randAccount.provider.getBalance(testSeqno.getAddress())).to.be.equal(124);

            await moleculaPool.addInWhiteList(testSeqno, '0x00000000');

            // Call receive function
            await moleculaPool
                .connect(keeperSigner)
                .execute(testSeqno.getAddress(), '0x', { value: 124 });
            expect(await testSeqno.seqno()).to.be.equal(13n + 10n);
            expect(await randAccount.provider.getBalance(testSeqno.getAddress())).to.be.equal(
                2 * 124,
            );

            // Call touch function
            await moleculaPool.addInWhiteList(
                testSeqno,
                testSeqno.interface.getFunction('touch').selector,
            );
            const encodedTouch = testSeqno.interface.encodeFunctionData('touch');
            await moleculaPool
                .connect(keeperSigner)
                .execute(testSeqno.getAddress(), encodedTouch, { value: 124 });
            expect(await testSeqno.seqno()).to.be.equal(13n + 10n + 1n);
            expect(await randAccount.provider.getBalance(testSeqno.getAddress())).to.be.equal(
                3 * 124,
            );
        });

        it('Test modifiers reverts MoleculaPoolTreasury', async () => {
            const { moleculaPool, randAccount, malicious, USDT } =
                await loadFixture(deployNitrogenWithUSDT);

            await expect(
                moleculaPool.connect(randAccount).addToken(randAccount),
            ).to.be.rejectedWith('OwnableUnauthorizedAccount');

            await expect(
                moleculaPool.connect(randAccount).removeToken(randAccount),
            ).to.be.rejectedWith('OwnableUnauthorizedAccount');

            await expect(
                moleculaPool.connect(randAccount).setPoolKeeper(randAccount),
            ).to.be.rejectedWith('OwnableUnauthorizedAccount');

            await expect(moleculaPool.setPoolKeeper(ethers.ZeroAddress)).to.be.rejectedWith(
                'EZeroAddress()',
            );

            await expect(
                moleculaPool.deposit(ethers.ZeroAddress, 0n, ethers.ZeroAddress, 0n),
            ).to.be.rejectedWith('ENotAuthorized()');

            await expect(moleculaPool.requestRedeem(ethers.ZeroAddress, 0n)).to.be.rejectedWith(
                'ENotAuthorized()',
            );

            await expect(moleculaPool.connect(randAccount).redeem([])).to.be.rejectedWith(
                'EEmptyArray()',
            );

            await expect(
                moleculaPool.addInWhiteList(ethers.ZeroAddress, '0x00000000'),
            ).to.be.rejectedWith('EZeroAddress()');

            await expect(
                moleculaPool.deleteFromWhiteList(ethers.ZeroAddress, '0x00000000'),
            ).to.be.rejectedWith('ENotPresentInWhiteList()');

            const encodedTransfer = USDT.interface.encodeFunctionData('transfer', [
                malicious.address,
                await USDT.balanceOf(moleculaPool.getAddress()),
            ]);
            await expect(
                moleculaPool.connect(randAccount).execute(USDT.getAddress(), encodedTransfer),
            ).to.be.rejectedWith('ENotAuthorized()');

            await expect(
                moleculaPool.connect(randAccount).setAgent(ethers.ZeroAddress, true),
            ).to.be.rejectedWith('ENotAuthorized()');

            await expect(
                moleculaPool.connect(randAccount).migrate(ethers.ZeroAddress),
            ).to.be.rejectedWith('ENotAuthorized()');

            await moleculaPool.setPoolKeeper(randAccount);
        });

        it('Test MoleculaPoolTreasury constructor zero address in array', async () => {
            const { poolOwner } = await loadFixture(deployNitrogenWithUSDT);

            const MoleculaPool_revert = await ethers.getContractFactory('MoleculaPoolTreasuryV2');
            await expect(
                MoleculaPool_revert.connect(poolOwner).deploy(
                    poolOwner.address,
                    [],
                    poolOwner.address,
                    poolOwner.address,
                    [{ target: ethers.ZeroAddress, selector: '0x00000000' }],
                    poolOwner.address,
                    ethers.ZeroAddress,
                ),
            ).to.be.rejectedWith('EZeroAddress()');
        });
    });

    describe('Test pause', () => {
        it('Test pauseExecute', async () => {
            const {
                moleculaPool,
                guardian,
                poolOwner,
                failToExecuteFunctions,
                executeFunctions,
                randAccount,
            } = await loadFixture(initNitrogenForPause);

            // Tests msg.sender
            await expect(moleculaPool.connect(randAccount).pauseExecute()).to.be.rejectedWith(
                'EBadSender()',
            );
            await expect(moleculaPool.connect(guardian).unpauseExecute()).to.be.rejectedWith(
                'OwnableUnauthorizedAccount',
            );

            // Pause `execute` function
            await moleculaPool.connect(guardian).pauseExecute();
            // Fail to call `execute` function
            await failToExecuteFunctions('EExecutePaused()');
            // Unpause `execute` function
            await moleculaPool.connect(poolOwner).unpauseExecute();
            // Call `execute` function
            await executeFunctions();
        });

        it('Test pauseAll', async () => {
            const {
                moleculaPool,
                guardian,
                poolOwner,
                failToExecuteFunctions,
                executeFunctions,
                randAccount,
            } = await loadFixture(initNitrogenForPause);

            // Tests msg.sender
            await expect(moleculaPool.connect(randAccount).pauseAll()).to.be.rejectedWith(
                'EBadSender()',
            );
            await expect(moleculaPool.connect(guardian).unpauseAll()).to.be.rejectedWith(
                'OwnableUnauthorizedAccount',
            );

            // Pause `execute` function
            await moleculaPool.connect(guardian).pauseAll();
            // Fail to call `execute` function
            await failToExecuteFunctions('EExecutePaused()');
            // Unpause `execute` function
            await moleculaPool.connect(poolOwner).unpauseAll();
            // Call `execute` function
            await executeFunctions();
        });

        it('Test block token and execute function', async () => {
            const {
                moleculaPool,
                guardian,
                poolOwner,
                failToExecuteFunctions,
                executeFunctions,
                USDT,
            } = await loadFixture(initNitrogenForPause);

            // Tests msg.sender
            await expect(
                moleculaPool.connect(guardian).setBlockToken(USDT, true),
            ).to.be.rejectedWith('OwnableUnauthorizedAccount');

            // Pause `execute` function
            await moleculaPool.connect(poolOwner).setBlockToken(USDT, true);
            // It's ok if we call it again
            await moleculaPool.connect(poolOwner).setBlockToken(USDT, true);
            // Fail to call `execute` function
            await failToExecuteFunctions('ETokenBlocked');
            // Unpause `execute` function
            await moleculaPool.connect(poolOwner).setBlockToken(USDT, false);
            // Call `execute` function
            await executeFunctions();
        });

        it('Test pause redeem', async () => {
            const {
                moleculaPool,
                guardian,
                user0,
                rebaseToken,
                malicious,
                poolOwner,
                USDT,
                operationId,
                redeemValue,
                randAccount,
            } = await loadFixture(initNitrogenAndRequestDeposit);

            await expect(moleculaPool.connect(randAccount).pauseRedeem()).to.be.rejectedWith(
                'EBadSender()',
            );
            await expect(moleculaPool.connect(guardian).unpauseRedeem()).to.be.rejectedWith(
                'OwnableUnauthorizedAccount',
            );

            // pause redeem, fail to redeem to user
            await moleculaPool.connect(guardian).pauseRedeem();
            await expect(moleculaPool.connect(malicious).redeem([operationId])).to.be.rejectedWith(
                'ERedeemPaused()',
            );

            // unpause redeem, redeem to user
            await moleculaPool.connect(poolOwner).unpauseRedeem();
            await moleculaPool.connect(malicious).redeem([operationId]);

            // anyone calls confirmRedeem for user
            await rebaseToken.connect(user0).confirmRedeem(operationId);
            expect(await USDT.balanceOf(user0)).to.be.equal(redeemValue);
        });

        it('Test pauseAll', async () => {
            const {
                moleculaPool,
                guardian,
                user0,
                rebaseToken,
                malicious,
                poolOwner,
                USDT,
                operationId,
                redeemValue,
            } = await loadFixture(initNitrogenAndRequestDeposit);

            await expect(moleculaPool.connect(guardian).unpauseAll()).to.be.rejectedWith(
                'OwnableUnauthorizedAccount',
            );

            // pause redeem, fail to redeem to user
            await moleculaPool.connect(guardian).pauseAll();
            await expect(moleculaPool.connect(malicious).redeem([operationId])).to.be.rejectedWith(
                'ERedeemPaused()',
            );

            // unpause redeem, redeem to user
            await moleculaPool.connect(poolOwner).unpauseAll();
            await moleculaPool.connect(malicious).redeem([operationId]);

            // anyone calls confirmRedeem for user
            await rebaseToken.connect(user0).confirmRedeem(operationId);
            expect(await USDT.balanceOf(user0)).to.be.equal(redeemValue);
        });

        it('Test changeGuardian', async () => {
            const { moleculaPool, randAccount, poolOwner } =
                await loadFixture(deployNitrogenWithUSDT);
            expect(await moleculaPool.guardian()).to.not.equal(randAccount);
            await expect(
                moleculaPool.connect(randAccount).changeGuardian(randAccount),
            ).to.be.rejectedWith('OwnableUnauthorizedAccount');
            await expect(
                moleculaPool.connect(poolOwner).changeGuardian(ethers.ZeroAddress),
            ).to.be.rejectedWith('EZeroAddress()');
            await moleculaPool.connect(poolOwner).changeGuardian(randAccount);
            expect(await moleculaPool.guardian()).to.equal(randAccount);
        });

        it('Should block token', async () => {
            const {
                moleculaPool,
                user0,
                rebaseToken,
                malicious,
                poolOwner,
                USDT,
                randAccount,
                operationId,
                redeemValue,
            } = await loadFixture(initNitrogenAndRequestDeposit);

            await expect(
                moleculaPool.connect(poolOwner).setBlockToken(randAccount, true),
            ).to.be.rejectedWith('ETokenNotExist');
            await expect(
                moleculaPool.connect(randAccount).setBlockToken(USDT, true),
            ).to.be.rejectedWith('OwnableUnauthorizedAccount');

            // block token, fail to redeem to user
            await moleculaPool.connect(poolOwner).setBlockToken(USDT, true);
            await expect(moleculaPool.connect(malicious).redeem([operationId])).to.be.rejectedWith(
                'ETokenBlocked()',
            );

            // unblock token, redeem to user
            await moleculaPool.connect(poolOwner).setBlockToken(USDT, false);
            await moleculaPool.connect(malicious).redeem([operationId]);

            // anyone calls confirmRedeem for user
            await rebaseToken.connect(user0).confirmRedeem(operationId);
            expect(await USDT.balanceOf(user0)).to.be.equal(redeemValue);
        });

        it('Test pause agent accountant', async () => {
            const { moleculaPool, rebaseToken, agent, user0, USDT } =
                await loadFixture(deployNitrogenWithUSDT);
            const depositValue = 100_000_000n;

            await grantERC20(user0, USDT, 2n * depositValue);
            // approve USDT to agent
            await USDT.connect(user0).approve(await agent.getAddress(), 2n * depositValue);

            // user0 calls requestDeposit on rebaseToken
            await agent.pauseRequestDeposit();
            await expect(
                rebaseToken.connect(user0).requestDeposit(depositValue, user0, user0),
            ).to.be.rejectedWith('ERequestDepositPaused');
            await agent.unpauseRequestDeposit();
            await rebaseToken.connect(user0).requestDeposit(depositValue, user0, user0);

            // user0 calls requestDeposit on rebaseToken
            await agent.pauseAll();
            await expect(
                rebaseToken.connect(user0).requestDeposit(depositValue, user0, user0),
            ).to.be.rejectedWith('ERequestDepositPaused');
            await agent.unpauseAll();
            await rebaseToken.connect(user0).requestDeposit(depositValue, user0, user0);

            const redeemShares = await rebaseToken.sharesOf(user0);

            // user asks for redeem
            await agent.pauseRequestRedeem();
            await expect(
                rebaseToken.connect(user0).requestRedeem(redeemShares / 2n, user0, user0),
            ).to.be.rejectedWith('ERequestRedeemPaused()');
            await agent.unpauseRequestRedeem();
            let tx = await rebaseToken
                .connect(user0)
                .requestRedeem(redeemShares / 2n, user0, user0);
            const { operationId: operationId0, redeemValue: redeemValue0 } =
                await findRequestRedeemEvent(tx);

            // user asks for redeem
            await agent.pauseAll();
            await expect(
                rebaseToken
                    .connect(user0)
                    .requestRedeem(redeemShares - redeemShares / 2n, user0, user0),
            ).to.be.rejectedWith('ERequestRedeemPaused()');
            await agent.unpauseAll();
            tx = await rebaseToken
                .connect(user0)
                .requestRedeem(redeemShares - redeemShares / 2n, user0, user0);
            const { operationId: operationId1, redeemValue: redeemValue1 } =
                await findRequestRedeemEvent(tx);

            // redeem and confirmRedeem
            await moleculaPool.connect(user0).redeem([operationId0, operationId1]);
            await rebaseToken.connect(user0).confirmRedeem(operationId0);
            await rebaseToken.connect(user0).confirmRedeem(operationId1);
            expect(await USDT.balanceOf(user0)).to.be.equal(redeemValue0 + redeemValue1);
        });

        it('Test changeGuardian for agent accountant', async () => {
            const { agent, poolOwner, randAccount } = await loadFixture(deployNitrogenWithUSDT);
            await expect(agent.connect(randAccount).changeGuardian(randAccount)).to.be.rejectedWith(
                'OwnableUnauthorizedAccount',
            );
            await agent.connect(poolOwner).changeGuardian(randAccount);
        });

        it('Test pause agent accountant (conner cases)', async () => {
            const { agent, randAccount } = await loadFixture(deployNitrogenWithUSDT);
            await agent.pauseAll();
            await agent.pauseAll();

            await expect(agent.connect(randAccount).pauseAll()).to.be.rejectedWith('EBadSender()');
            await expect(agent.connect(randAccount).pauseRequestDeposit()).to.be.rejectedWith(
                'EBadSender()',
            );
            await expect(agent.connect(randAccount).pauseRequestRedeem()).to.be.rejectedWith(
                'EBadSender()',
            );

            await expect(agent.connect(randAccount).unpauseAll()).to.be.rejectedWith(
                'OwnableUnauthorizedAccount',
            );
            await expect(agent.connect(randAccount).unpauseRequestDeposit()).to.be.rejectedWith(
                'OwnableUnauthorizedAccount',
            );
            await expect(agent.connect(randAccount).unpauseRequestRedeem()).to.be.rejectedWith(
                'OwnableUnauthorizedAccount',
            );
        });
    });

    it('Test migrate', async () => {
        const {
            moleculaPool,
            rebaseToken,
            agent,
            user0,
            user1,
            malicious,
            USDT,
            poolOwner,
            poolKeeper,
            supplyManager,
            guardian,
        } = await loadFixture(deployNitrogenWithUSDTAndOldPool);
        // deposit 100 USDT
        const depositValue = 100_000_000n;
        // Grant user wallet with 100 USDT
        await grantERC20(user0, USDT, depositValue);
        // approve USDT to agent
        await USDT.connect(user0).approve(await agent.getAddress(), depositValue);

        // user0 calls requestDeposit on rebaseToken
        await rebaseToken.connect(user0).requestDeposit(depositValue, user0, user0);

        // user asks for redeem
        const redeemShares = await rebaseToken.sharesOf(user0);
        const tx = await rebaseToken.connect(user0).requestRedeem(redeemShares, user0, user0);
        const eventData = await findRequestRedeemEvent(tx);

        const MoleculaPool = await ethers.getContractFactory('MoleculaPoolTreasuryV2');
        const newMoleculaPool = await MoleculaPool.connect(poolOwner).deploy(
            poolOwner.address,
            [USDT],
            poolKeeper,
            supplyManager,
            [],
            guardian,
            ethers.ZeroAddress,
        );

        await moleculaPool.connect(poolOwner).addInWhiteList(newMoleculaPool);
        const pool = await moleculaPool.getTokenPool();
        for (const p of pool) {
            const token = await ethers.getContractAt('IERC20', p.token);
            const encodedTransfer = token.interface.encodeFunctionData('approve', [
                await newMoleculaPool.getAddress(),
                ethers.MaxUint256,
            ]);
            await moleculaPool.connect(poolKeeper).execute(token, encodedTransfer);
            expect(await token.allowance(moleculaPool, newMoleculaPool)).to.be.equal(
                ethers.MaxUint256,
            );
        }
        await supplyManager.setMoleculaPool(newMoleculaPool);

        // user0 calls redeem
        await newMoleculaPool.connect(malicious).redeem([eventData.operationId]);
        // anyone calls confirmRedeem for user
        await rebaseToken.connect(user1).confirmRedeem(eventData.operationId);
    });

    it('Test migrating errors', async () => {
        const { malicious, USDT, poolOwner, poolKeeper, supplyManager, guardian } =
            await loadFixture(deployNitrogenWithUSDTAndOldPool);
        const MoleculaPool = await ethers.getContractFactory('MoleculaPoolTreasuryV2');

        let newMoleculaPool = await MoleculaPool.connect(poolOwner).deploy(
            malicious,
            [USDT],
            poolKeeper,
            supplyManager,
            [],
            guardian,
            ethers.ZeroAddress,
        );
        await expect(supplyManager.setMoleculaPool(newMoleculaPool)).to.be.rejectedWith(
            'EBadOwner()',
        );

        newMoleculaPool = await MoleculaPool.connect(poolOwner).deploy(
            poolOwner.address,
            [USDT],
            malicious,
            supplyManager,
            [],
            guardian,
            ethers.ZeroAddress,
        );
        await expect(supplyManager.setMoleculaPool(newMoleculaPool)).to.be.rejectedWith(
            'EBadPoolKeeper()',
        );

        newMoleculaPool = await MoleculaPool.connect(poolOwner).deploy(
            poolOwner.address,
            [USDT],
            poolKeeper,
            supplyManager,
            [],
            malicious,
            ethers.ZeroAddress,
        );
        await expect(supplyManager.setMoleculaPool(newMoleculaPool)).to.be.rejectedWith(
            'EBadGuardian()',
        );
    });

    it('Deposit and delete token', async () => {
        const { moleculaPool, rebaseToken, agent, user0, USDT, poolOwner } =
            await loadFixture(deployNitrogenWithUSDT);

        // deposit 100 USDT
        const depositValue = 100n * 10n ** 6n;
        // Grant user wallet with 100 USDT
        await grantERC20(user0, USDT, 2n * depositValue);
        // approve USDT to agent
        await USDT.connect(user0).approve(await agent.getAddress(), ethers.MaxUint256);

        // user0 calls requestDeposit on rebaseToken
        await rebaseToken.connect(user0).requestDeposit(depositValue, user0, user0);
        const shares = await rebaseToken.sharesOf(user0);

        await moleculaPool.connect(poolOwner).removeToken(USDT);
        await expect(
            rebaseToken.connect(user0).requestDeposit(depositValue, user0, user0),
        ).to.be.rejectedWith('ETokenNotExist');
        await expect(
            rebaseToken.connect(user0).requestRedeem(shares, user0, user0),
        ).to.be.rejectedWith('ETokenNotExist');
    });

    it('Test MoleculaPoolTreasuryV2.totalSupply()', async () => {
        const {
            moleculaPool,
            rebaseToken,
            agent,
            user0,
            USDT,
            poolOwner,
            randAccount,
            poolKeeper,
            DAI,
        } = await loadFixture(deployNitrogenWithUSDT);

        // deposit 100 USDT
        const depositValue = 100n * 10n ** 6n;
        // Grant user wallet with 100 USDT
        await grantERC20(user0, USDT, 2n * depositValue);
        // approve USDT to agent
        await USDT.connect(user0).approve(await agent.getAddress(), ethers.MaxUint256);

        // user0 calls requestDeposit on rebaseToken
        await rebaseToken.connect(user0).requestDeposit(depositValue, user0, user0);
        const shares = await rebaseToken.sharesOf(user0);
        await rebaseToken.connect(user0).requestRedeem(shares, user0, user0);

        await getRidOf(moleculaPool, poolOwner, USDT, randAccount.address, poolKeeper);
        await getRidOf(moleculaPool, poolOwner, DAI, randAccount.address, poolKeeper);
        expect(await moleculaPool.totalSupply()).to.be.equal(0);
        const { supply, totalRedeem } = await moleculaPool.totalPoolsSupplyAndRedeem();
        expect(supply).to.be.equal(0);
        expect(totalRedeem).to.be.greaterThan(0);
    });
});
