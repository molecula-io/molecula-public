/* eslint-disable camelcase, max-lines */
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';

import { ethMainnetBetaConfig } from '../../../configs';

import {
    REQUEST_DEPOSIT,
    CONFIRM_DEPOSIT,
    REQUEST_REDEEM,
    CONFIRM_REDEEM,
    CONFIRM_DEPOSIT_AND_UPDATE_ORACLE,
    DISTRIBUTE_YIELD,
    DISTRIBUTE_YIELD_AND_UPDATE_ORACLE,
    UPDATE_ORACLE,
} from '../../../scripts/utils/lzTronSetupUtils';

import { deployCarbon } from '../../utils/Carbon';
import { DAI_INITIAL_SUPPLY } from '../../utils/NitrogenCommon';
import {
    findRequestRedeemEvent,
    findRequestDepositEvent,
    findConfirmDepositEvent,
    findRedeemRequestEvent,
    findDistributeYieldEvent,
} from '../../utils/event';
import { grantERC20 } from '../../utils/grant';

describe('Test Carbon', () => {
    describe('General solution tests', () => {
        it('Should set the right poolOwner', async () => {
            const { moleculaPool, supplyManager, poolOwner, oracle, user0 } =
                await loadFixture(deployCarbon);

            expect(await moleculaPool.owner()).to.equal(await poolOwner.getAddress());
            expect(await supplyManager.owner()).to.equal(await poolOwner.getAddress());
            expect(await moleculaPool.totalSupply()).to.equal(100_000_000_000_000_000_000n);
            expect(await supplyManager.totalSupply()).to.equal(100_000_000_000_000_000_000n);

            expect(await oracle.owner()).to.equal(await poolOwner.getAddress());
            expect(await oracle.transferOwnership!(user0)).to.ok;

            // transferOwnership shouldn't change owner
            expect(await oracle.owner()).to.equal(await poolOwner.getAddress());

            // acceptOwnership should change owner
            expect(await oracle.connect(user0).acceptOwnership()).to.ok;
            expect(await oracle.owner()).to.equal(await user0.getAddress());
        });
        it('Test set lzOptions and quotes', async () => {
            const { agentLZ, accountantLZ, user0 } = await loadFixture(deployCarbon);

            await agentLZ.setGasLimit(CONFIRM_DEPOSIT, 300_000n, 0n);
            await agentLZ.setGasLimit(CONFIRM_DEPOSIT_AND_UPDATE_ORACLE, 350_000n, 0n);
            await agentLZ.setGasLimit(DISTRIBUTE_YIELD, 200_000n, 50_000n);

            expect(await agentLZ.getLzOptions(CONFIRM_DEPOSIT, 0)).to.equal(
                '0x000301001101000000000000000000000000000493e0',
            );
            expect(await agentLZ.getLzOptions(CONFIRM_DEPOSIT, 5)).to.equal(
                '0x000301001101000000000000000000000000000493e0',
            );
            expect(await agentLZ.getLzOptions(CONFIRM_DEPOSIT_AND_UPDATE_ORACLE, 0)).to.equal(
                '0x00030100110100000000000000000000000000055730',
            );
            expect(await agentLZ.getLzOptions(DISTRIBUTE_YIELD, 0)).to.equal(
                '0x00030100110100000000000000000000000000030d40',
            );
            expect(await agentLZ.getLzOptions(DISTRIBUTE_YIELD, 1)).to.equal(
                '0x0003010011010000000000000000000000000003d090',
            );
            expect(await agentLZ.getLzOptions(DISTRIBUTE_YIELD, 3)).to.equal(
                '0x00030100110100000000000000000000000000055730',
            );

            expect((await agentLZ.quote(CONFIRM_DEPOSIT, 0)).nativeFee).to.not.equal(0n);
            expect(
                (await agentLZ.quote(CONFIRM_DEPOSIT_AND_UPDATE_ORACLE, 0)).nativeFee,
            ).to.not.equal(0n);
            await expect(agentLZ.quote(REQUEST_REDEEM, 0)).to.be.reverted;
            expect((await agentLZ.quote(CONFIRM_REDEEM, 0)).nativeFee).to.not.equal(0n);
            expect((await agentLZ.quote(REQUEST_DEPOSIT, 0)).nativeFee).to.be.equal(0n);

            expect((await accountantLZ.quote(REQUEST_REDEEM)).nativeFee).to.be.equal(0n);
            expect((await accountantLZ.quote(REQUEST_DEPOSIT)).nativeFee).to.not.equal(0n);
            await expect(accountantLZ.quote(CONFIRM_DEPOSIT)).to.be.reverted;

            expect((await accountantLZ.quote(REQUEST_DEPOSIT)).nativeFee).to.not.equal(0n);

            await agentLZ.setSendOracleData(true);
            await expect(agentLZ.connect(user0).setSendOracleData(true)).to.be.reverted;
            await expect(agentLZ.connect(user0).redeem(user0, [0n], [0n], 0n)).to.be.reverted;
            await expect(agentLZ.connect(user0).distribute([user0], [0n])).to.be.reverted;
        });
        it('Test update oracle', async () => {
            const { supplyManager, agentLZ, moleculaPool } = await loadFixture(deployCarbon);

            const val = DAI_INITIAL_SUPPLY * 3n;
            expect(await supplyManager.totalSupply()).to.equal(DAI_INITIAL_SUPPLY);
            expect(await supplyManager.totalSharesSupply()).to.equal(DAI_INITIAL_SUPPLY);
            const DAI = await ethers.getContractAt('IERC20', ethMainnetBetaConfig.DAI_ADDRESS);
            // generate income
            await grantERC20(await moleculaPool.poolKeeper(), DAI, val);

            // get quote
            const quote = await agentLZ.quote(UPDATE_ORACLE, 0);

            // update oracle
            await agentLZ.updateOracle({ value: quote.nativeFee });
        });
        it('LZ Deposit and Redeem Flow', async () => {
            const {
                moleculaPool,
                agentLZ,
                accountantLZ,
                mockLZEndpoint,
                mockUsdtOFT,
                user0,
                USDT,
                rebaseTokenTron,
            } = await loadFixture(deployCarbon);

            const depositValue = 100_000_000n;

            await grantERC20(user0, USDT, depositValue);
            expect(await USDT.balanceOf(user0)).to.equal(depositValue);
            expect(await USDT.balanceOf(await agentLZ.getAddress())).to.equal(0n);
            expect(await USDT.balanceOf(mockUsdtOFT)).to.equal(10_000_000_000n);
            expect(await USDT.balanceOf(await moleculaPool.poolKeeper())).to.equal(0n);

            // Owner approves USDT for accountantLZ
            await USDT.connect(user0).approve(await accountantLZ.getAddress(), depositValue);

            // Owner calls requestDeposit on rebaseToken
            let tx = await rebaseTokenTron
                .connect(user0)
                .requestDeposit(depositValue, user0, user0, { value: 100_000_000_000_000_000n });

            const eventRequestDeposit = await findRequestDepositEvent(tx);

            const { requestId } = eventRequestDeposit;

            expect(await USDT.balanceOf(user0)).to.equal(0n);
            expect(await USDT.balanceOf(await agentLZ.getAddress())).to.equal(99_900_000n);
            expect(await USDT.balanceOf(mockUsdtOFT)).to.equal(10_000_100_000n);
            expect(await USDT.balanceOf(await moleculaPool.poolKeeper())).to.equal(0n);

            // send lz requestDeposit data for ethereum agentLZ
            await mockLZEndpoint.lzReceive(
                await agentLZ.getAddress(),
                ethMainnetBetaConfig.LAYER_ZERO_ETHEREUM_EID,
                ethers.zeroPadValue(await accountantLZ.getAddress(), 32),
                REQUEST_DEPOSIT,
                requestId,
                99_900_000n,
            );

            tx = await agentLZ.confirmDeposit(requestId);
            const eventConfirmDeposit = await findConfirmDepositEvent(tx);

            const { shares } = eventConfirmDeposit;

            expect(await USDT.balanceOf(await agentLZ.getAddress())).to.equal(0n);

            expect(await rebaseTokenTron.sharesOf(user0)).to.equal(0n);

            // send lz requestDeposit data for ethereum agentLZ
            await mockLZEndpoint.lzReceive(
                await accountantLZ.getAddress(),
                ethMainnetBetaConfig.LAYER_ZERO_ETHEREUM_EID,
                ethers.zeroPadValue(await agentLZ.getAddress(), 32),
                CONFIRM_DEPOSIT,
                requestId,
                shares,
            );

            expect(await rebaseTokenTron.sharesOf(user0)).to.be.equal(shares);

            tx = await rebaseTokenTron
                .connect(user0)
                .requestRedeem(ethers.MaxUint256, user0, user0);
            const eventRequestRedeem = await findRedeemRequestEvent(tx);

            const requestIdForRedeem = eventRequestRedeem.requestId;
            const sharesToRedeem = eventRequestRedeem.shares;

            // send lz requestDeposit data for ethereum agentLZ
            tx = await mockLZEndpoint.lzReceive(
                await agentLZ.getAddress(),
                ethMainnetBetaConfig.LAYER_ZERO_ETHEREUM_EID,
                ethers.zeroPadValue(await accountantLZ.getAddress(), 32),
                REQUEST_REDEEM,
                requestIdForRedeem,
                sharesToRedeem,
            );

            const eventData = await findRequestRedeemEvent(tx);
            const { operationId } = eventData;

            expect(await USDT.balanceOf(accountantLZ)).to.equal(0n);

            await moleculaPool.redeem([operationId], { value: 1_000_000_000_000_000_000n });

            expect(await USDT.balanceOf(accountantLZ)).to.equal(99_800_100n);

            await mockLZEndpoint.lzReceive(
                await accountantLZ.getAddress(),
                ethMainnetBetaConfig.LAYER_ZERO_ETHEREUM_EID,
                ethers.zeroPadValue(await agentLZ.getAddress(), 32),
                CONFIRM_REDEEM,
                requestIdForRedeem,
                99_800_100n,
            );

            expect(await USDT.balanceOf(user0)).to.equal(0n);

            await rebaseTokenTron.confirmRedeem(requestIdForRedeem);

            expect(await USDT.balanceOf(user0)).to.equal(99_800_100n);
            expect(await USDT.balanceOf(accountantLZ)).to.equal(0n);
        });
        it('Distribute yield', async () => {
            const {
                moleculaPool,
                supplyManager,
                agentLZ,
                user0,
                USDT,
                rebaseTokenTron,
                mockLZEndpoint,
                accountantLZ,
            } = await loadFixture(deployCarbon);

            const val = 100n * 10n ** 18n;
            const incomeValue = 100_000_000n;
            expect(await supplyManager.totalSupply()).to.equal(val);
            expect(await supplyManager.totalSharesSupply()).to.equal(val);

            // generate income
            await grantERC20(await moleculaPool.getAddress(), USDT, incomeValue);

            expect(await supplyManager.totalSupply()).to.equal(val + 40n * 10n ** 18n);
            expect(await supplyManager.totalSharesSupply()).to.equal(val);
            expect(await rebaseTokenTron.sharesOf(user0)).to.equal(0n);

            // distribute yield params
            const party = {
                parties: [
                    {
                        party: user0.address,
                        portion: 10n ** 18n,
                    },
                ],
                agent: agentLZ,
                ethValue: 100_000_000_000_000_000n,
            };
            // distribute yield
            let tx = await supplyManager.distributeYield([party], 5000, {
                value: 100_000_000_000_000_000n,
            });
            let distributeEventData = await findDistributeYieldEvent(tx);

            expect(await supplyManager.apyFormatter()).to.equal(5000);
            expect(await supplyManager.totalSupply()).to.equal(200n * 10n ** 18n);
            expect(await supplyManager.totalSharesSupply()).to.equal(142857142857142857142n);

            const users = [...distributeEventData.users];
            const shares = [...distributeEventData.shares];

            await mockLZEndpoint.lzReceiveDistributeYield(
                await accountantLZ.getAddress(),
                ethMainnetBetaConfig.LAYER_ZERO_ETHEREUM_EID,
                ethers.zeroPadValue(await agentLZ.getAddress(), 32),
                DISTRIBUTE_YIELD,
                users,
                shares,
            );

            expect(await rebaseTokenTron.sharesOf(user0)).to.equal(shares[0]);

            // generate income
            await grantERC20(await moleculaPool.getAddress(), USDT, incomeValue);

            // distribute yield and update oracle
            tx = await supplyManager.distributeYield([party], 5000, {
                value: 100_000_000_000_000_000n,
            });
            distributeEventData = await findDistributeYieldEvent(tx);

            const users1 = [...distributeEventData.users];
            const shares2 = [...distributeEventData.shares];

            const totalData = await supplyManager.getTotalSupply();

            await mockLZEndpoint.lzReceiveDistributeYieldAndUpdateOracle(
                await accountantLZ.getAddress(),
                ethMainnetBetaConfig.LAYER_ZERO_ETHEREUM_EID,
                ethers.zeroPadValue(await agentLZ.getAddress(), 32),
                DISTRIBUTE_YIELD_AND_UPDATE_ORACLE,
                users1,
                shares2,
                totalData[0],
                totalData[1],
            );

            await mockLZEndpoint.lzReceive(
                await accountantLZ.getAddress(),
                ethMainnetBetaConfig.LAYER_ZERO_ETHEREUM_EID,
                ethers.zeroPadValue(await agentLZ.getAddress(), 32),
                UPDATE_ORACLE,
                totalData[0],
                totalData[1],
            );

            await expect(
                mockLZEndpoint.lzReceive(
                    await accountantLZ.getAddress(),
                    ethMainnetBetaConfig.LAYER_ZERO_ETHEREUM_EID,
                    ethers.zeroPadValue(await agentLZ.getAddress(), 32),
                    REQUEST_REDEEM,
                    totalData[0],
                    totalData[1],
                ),
            ).to.be.reverted;

            await expect(
                mockLZEndpoint.lzReceive(
                    await agentLZ.getAddress(),
                    ethMainnetBetaConfig.LAYER_ZERO_ETHEREUM_EID,
                    ethers.zeroPadValue(await accountantLZ.getAddress(), 32),
                    UPDATE_ORACLE,
                    totalData[0],
                    totalData[1],
                ),
            ).to.be.reverted;
        });

        it('Test branches for agents', async () => {
            const { agentLZ } = await loadFixture(deployCarbon);

            await agentLZ.setGasLimit(CONFIRM_DEPOSIT, 300_000n, 0n);
            await agentLZ.setGasLimit(CONFIRM_DEPOSIT_AND_UPDATE_ORACLE, 350_000n, 0n);
            await agentLZ.setGasLimit(DISTRIBUTE_YIELD, 200_000n, 50_000n);

            expect(await agentLZ.getLzOptions(CONFIRM_DEPOSIT, 0)).to.equal(
                '0x000301001101000000000000000000000000000493e0',
            );
            expect(await agentLZ.getLzOptions(CONFIRM_DEPOSIT, 5)).to.equal(
                '0x000301001101000000000000000000000000000493e0',
            );
            expect(await agentLZ.getLzOptions(CONFIRM_DEPOSIT_AND_UPDATE_ORACLE, 0)).to.equal(
                '0x00030100110100000000000000000000000000055730',
            );
            expect(await agentLZ.getLzOptions(DISTRIBUTE_YIELD, 0)).to.equal(
                '0x00030100110100000000000000000000000000030d40',
            );
            expect(await agentLZ.getLzOptions(DISTRIBUTE_YIELD, 1)).to.equal(
                '0x0003010011010000000000000000000000000003d090',
            );
            expect(await agentLZ.getLzOptions(DISTRIBUTE_YIELD, 3)).to.equal(
                '0x00030100110100000000000000000000000000055730',
            );

            expect((await agentLZ.quote(CONFIRM_DEPOSIT, 0)).nativeFee).to.not.equal(0n);
            expect(
                (await agentLZ.quote(CONFIRM_DEPOSIT_AND_UPDATE_ORACLE, 0)).nativeFee,
            ).to.not.equal(0n);
            await expect(agentLZ.quote(REQUEST_REDEEM, 0)).to.be.reverted;
            expect((await agentLZ.quote(CONFIRM_REDEEM, 0)).nativeFee).to.not.equal(0n);
            expect((await agentLZ.quote(REQUEST_DEPOSIT, 0)).nativeFee).to.be.equal(0n);
        });

        it('Test confirm deposit with update oracle', async () => {
            const {
                moleculaPool,
                agentLZ,
                accountantLZ,
                mockLZEndpoint,
                mockUsdtOFT,
                user0,
                USDT,
                rebaseTokenTron,
                supplyManager,
            } = await loadFixture(deployCarbon);

            const depositValue = 100_000_000n;

            await grantERC20(user0, USDT, depositValue);
            expect(await USDT.balanceOf(user0)).to.equal(depositValue);
            expect(await USDT.balanceOf(await agentLZ.getAddress())).to.equal(0n);
            expect(await USDT.balanceOf(mockUsdtOFT)).to.equal(10_000_000_000n);
            expect(await USDT.balanceOf(await moleculaPool.poolKeeper())).to.equal(0n);

            // Owner approves USDT for accountantLZ
            await USDT.connect(user0).approve(await accountantLZ.getAddress(), depositValue);

            // Owner calls requestDeposit on rebaseToken
            let tx = await rebaseTokenTron
                .connect(user0)
                .requestDeposit(depositValue, user0, user0, { value: 100_000_000_000_000_000n });

            const eventRequestDeposit = await findRequestDepositEvent(tx);

            const { requestId } = eventRequestDeposit;

            expect(await USDT.balanceOf(user0)).to.equal(0n);
            expect(await USDT.balanceOf(await agentLZ.getAddress())).to.equal(99_900_000n);
            expect(await USDT.balanceOf(mockUsdtOFT)).to.equal(10_000_100_000n);
            expect(await USDT.balanceOf(await moleculaPool.poolKeeper())).to.equal(0n);

            // send lz requestDeposit data for ethereum agentLZ
            await mockLZEndpoint.lzReceive(
                await agentLZ.getAddress(),
                ethMainnetBetaConfig.LAYER_ZERO_ETHEREUM_EID,
                ethers.zeroPadValue(await accountantLZ.getAddress(), 32),
                REQUEST_DEPOSIT,
                requestId,
                99_900_000n,
            );

            tx = await agentLZ.confirmDeposit(requestId);
            const eventConfirmDeposit = await findConfirmDepositEvent(tx);

            const { shares } = eventConfirmDeposit;

            expect(await USDT.balanceOf(await agentLZ.getAddress())).to.equal(0n);

            expect(await rebaseTokenTron.sharesOf(user0)).to.equal(0n);

            const totalData = await supplyManager.getTotalSupply();

            // send lz requestDeposit data for ethereum agentLZ
            await mockLZEndpoint.lzReceiveAndUpdateOracle(
                await accountantLZ.getAddress(),
                ethMainnetBetaConfig.LAYER_ZERO_ETHEREUM_EID,
                ethers.zeroPadValue(await agentLZ.getAddress(), 32),
                CONFIRM_DEPOSIT_AND_UPDATE_ORACLE,
                requestId,
                shares,
                totalData[0],
                totalData[1],
            );
        });
    });
});
