/* eslint-disable camelcase, max-lines */
import { years } from '@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time/duration';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import { network, ethers } from 'hardhat';

import { APPROVER_SIGNATURE_AND_EXPIRY, APPROVER_SALT } from '../../../configs/ethereum/constants';
import { expectEqual } from '../../utils/math';
import { deployMrETh } from '../../utils/mrETH';
import { createValidatorKeys } from '../../utils/sign';

describe('Test mrETH DepositManager', () => {
    describe('General solution tests', () => {
        it('Should successfully request deposit and deposit WETH', async () => {
            const {
                depositManager,
                rebaseTokenV2,
                tokenVaultWETH,
                owner,
                WETH,
                aWETH,
                defaultWithdrawalCredentials,
            } = await loadFixture(deployMrETh);

            // Test deposit value of 1 WETH (18 decimals)
            const val = 1n * 10n ** 18n;

            // Verify initial balances
            expect(await WETH.balanceOf(owner)).to.be.greaterThan(val * 32n);
            expect(await aWETH.balanceOf(depositManager)).to.be.equal(0n);

            // First deposit request
            await tokenVaultWETH.connect(owner).requestDeposit(val, owner, owner);

            // Verify shares and balances after first deposit
            let userShares = await rebaseTokenV2.sharesOf(owner);

            expectEqual(await aWETH.balanceOf(depositManager), val);

            expectEqual(userShares, val);
            expectEqual(await rebaseTokenV2.convertToAssets(userShares), val);

            // Second deposit request
            await tokenVaultWETH.requestDeposit(val, owner, owner);

            // Verify balances after second deposit
            expect(await aWETH.balanceOf(depositManager)).to.be.greaterThanOrEqual(val * 2n);
            userShares = await rebaseTokenV2.sharesOf(owner);
            expect(userShares).to.be.lessThanOrEqual(val * 2n);
            expect(await rebaseTokenV2.convertToAssets(userShares)).to.be.greaterThanOrEqual(
                val * 2n,
            );

            // Generate validator keys for staking
            const { pubkey, signature, depositDataRoot } = createValidatorKeys(
                defaultWithdrawalCredentials,
            );

            // Large deposit request to prepare for staking
            await tokenVaultWETH.requestDeposit(val * 30n, owner, owner);
            expect(await aWETH.balanceOf(depositManager)).to.be.greaterThanOrEqual(val * 32n);

            // Perform staking operation
            await depositManager.stakeNative(val * 32n, pubkey, signature, depositDataRoot);

            // Verify final balances after staking
            expect(await aWETH.balanceOf(depositManager)).to.be.lessThan(val * 32n);
            expect(await aWETH.balanceOf(depositManager)).to.be.greaterThan(0n);

            userShares = await rebaseTokenV2.sharesOf(owner);
            expect(userShares).to.be.lessThan(val * 32n);
        });

        it('Should successfully stake with buffer percentage', async () => {
            const { depositManager, tokenVaultWETH, owner, WETH, defaultWithdrawalCredentials } =
                await loadFixture(deployMrETh);

            // Set buffer percentage to 5%
            await depositManager.setBufferPercentage(500n);

            // Test deposit value of 1 WETH (18 decimals)
            const val = 336n * 10n ** 17n;

            // Verify initial balances
            expect(await WETH.balanceOf(owner)).to.be.greaterThan(val * 2n);

            // First deposit request
            await tokenVaultWETH.connect(owner).requestDeposit(val, owner, owner);

            // Generate validator keys for staking
            const { pubkey, signature, depositDataRoot } = createValidatorKeys(
                defaultWithdrawalCredentials,
            );

            // Revert staking operation, not enough WETH in buffer
            await expect(
                depositManager.stakeNative(32n * 10n ** 18n, pubkey, signature, depositDataRoot),
            ).to.be.rejectedWith('ETooHighDepositValue()');

            // Deposit more to succeed stake
            await tokenVaultWETH.connect(owner).requestDeposit(10n ** 17n, owner, owner);

            // Perform staking operation
            await depositManager.stakeNative(32n * 10n ** 18n, pubkey, signature, depositDataRoot);

            await depositManager.setBufferPercentage(10_000n);
            await tokenVaultWETH.connect(owner).requestDeposit(val, owner, owner);
            await expect(
                depositManager.stakeNative(32n * 10n ** 18n, pubkey, signature, depositDataRoot),
            ).to.be.rejectedWith('ENoNeedToStake()');
        });

        it('Should successfully request deposit and deposit stETH', async () => {
            const { depositManager, rebaseTokenV2, tokenVaultStETH, owner, aWETH, stETH } =
                await loadFixture(deployMrETh);

            // Test deposit value of 1 WETH
            const val = 1n * 10n ** 18n;

            // Verify initial balances
            expect(await stETH.balanceOf(owner)).to.be.greaterThan(val * 2n);
            expect(await aWETH.balanceOf(depositManager)).to.be.equal(0n);

            // Perform deposit request
            await tokenVaultStETH.connect(owner).requestDeposit(val, owner, owner);

            // Verify shares and balances after deposit
            const userShares = await rebaseTokenV2.sharesOf(owner);
            expectEqual(userShares, val);
            expectEqual(await rebaseTokenV2.convertToAssets(userShares), val);
            expectEqual(await depositManager.totalSupply(), val);
        });

        it('Should successfully restake rewards for WETH and stETH', async () => {
            const { depositManager, owner, aWETH, WETH, stETH } = await loadFixture(deployMrETh);

            // Test deposit value of 1 WETH
            const val = 1n * 10n ** 18n;

            // Verify initial balances
            expect(await stETH.balanceOf(owner)).to.be.greaterThan(val * 2n);
            expect(await WETH.balanceOf(owner)).to.be.greaterThan(val * 2n);

            expect(await aWETH.balanceOf(depositManager)).to.be.equal(0n);
            expect(await WETH.balanceOf(depositManager)).to.be.equal(0n);
            expect(await stETH.balanceOf(depositManager)).to.be.equal(0n);

            // Perform deposit rewards to contract
            await WETH.transfer(depositManager, val);
            await stETH.transfer(depositManager, val);

            expect(await aWETH.balanceOf(depositManager)).to.be.equal(0n);
            expect(await WETH.balanceOf(depositManager)).to.be.equal(val);
            expectEqual(await stETH.balanceOf(depositManager), val);

            // Perform restake rewards
            await depositManager.restakeRewards([WETH, stETH], [val, val]);
            await expect(depositManager.restakeRewards([WETH], [val, val])).to.be.rejectedWith(
                'EIncorrectLength()',
            );

            expect(await aWETH.balanceOf(depositManager)).to.be.greaterThanOrEqual(val);
            expect(await WETH.balanceOf(depositManager)).to.be.equal(0n);
            expect(await stETH.balanceOf(depositManager)).to.be.equal(0n);
            expect(await depositManager.totalSupply()).to.be.greaterThanOrEqual(val * 2n);
        });

        it('Should successfully request deposit and deposit ETH', async () => {
            const {
                depositManager,
                rebaseTokenV2,
                nativeTokenVault,
                owner,
                WETH,
                aWETH,
                defaultWithdrawalCredentials,
            } = await loadFixture(deployMrETh);

            // Test deposit value of 1 ETH
            const val = 1n * 10n ** 18n;

            // Verify initial balances
            expect(await WETH.balanceOf(owner)).to.be.greaterThan(val * 32n);
            expect(await aWETH.balanceOf(depositManager)).to.be.equal(0n);

            // Test minimum deposit value validation
            await expect(nativeTokenVault.deposit(0, owner, { value: 1n })).to.be.reverted;

            // Verify initial state
            expect(await aWETH.balanceOf(depositManager)).to.be.equal(0n);
            let userShares = await rebaseTokenV2.sharesOf(owner);
            expect(userShares).to.be.equal(0n);
            expect(await rebaseTokenV2.convertToAssets(userShares)).to.be.equal(0n);

            // First deposit
            await nativeTokenVault.deposit(val, owner, { value: val });
            expectEqual(await aWETH.balanceOf(depositManager), val);
            userShares = await rebaseTokenV2.sharesOf(owner);
            expectEqual(userShares, val);
            expectEqual(await rebaseTokenV2.convertToAssets(userShares), val);

            // Second deposit
            await nativeTokenVault.deposit(val, owner, { value: val });

            // Verify balances after second deposit
            expect(await aWETH.balanceOf(depositManager)).to.be.greaterThan(val * 2n);
            userShares = await rebaseTokenV2.sharesOf(owner);
            expect(userShares).to.be.lessThanOrEqual(val * 3n);
            expect(await rebaseTokenV2.convertToAssets(userShares)).to.be.lessThan(val * 3n);

            // Generate validator keys for staking
            const { pubkey, signature, depositDataRoot } = createValidatorKeys(
                defaultWithdrawalCredentials,
            );

            // Large deposit to prepare for staking
            await nativeTokenVault.deposit(val * 30n, owner, { value: val * 30n });

            // Perform staking operation
            await depositManager.stakeNative(val * 32n, pubkey, signature, depositDataRoot);

            // Verify final balances after staking
            expect(await aWETH.balanceOf(depositManager)).to.be.lessThan(val * 32n);
            expect(await aWETH.balanceOf(depositManager)).to.be.greaterThan(0n);
            userShares = await rebaseTokenV2.sharesOf(owner);
            expect(userShares).to.be.lessThan(val * 32n);
        });

        it('Should successfully add pool to buffer', async () => {
            const {
                depositManager,
                rebaseTokenV2,
                tokenVaultWETH,
                owner,
                WETH,
                aWETH,
                cWETHv3,
                aavePool,
                aaveBufferLib,
                compoundBufferLib,
                defaultWithdrawalCredentials,
            } = await loadFixture(deployMrETh);

            // Configure two pools with equal portions (50% each)
            const setPoolData = [
                {
                    pool: aavePool,
                    newPoolData: {
                        poolToken: aWETH,
                        poolLib: aaveBufferLib,
                        poolPortion: 5_000n, // 50%
                        poolId: 0,
                    },
                    auth: true,
                },
                {
                    pool: cWETHv3,
                    newPoolData: {
                        poolToken: cWETHv3,
                        poolLib: compoundBufferLib,
                        poolPortion: 5_000n, // 50%
                        poolId: 1,
                    },
                    auth: true,
                },
            ];

            // Set up pools in the deposit manager
            await depositManager.setPools(setPoolData, 2);

            // Test deposit value of 1 WETH
            const val = 1n * 10n ** 18n;

            // Verify initial balance
            expect(await WETH.balanceOf(owner)).to.be.greaterThan(val * 32n);

            // First deposit and verify equal distribution
            await tokenVaultWETH.requestDeposit(val, owner, owner);
            expectEqual(await aWETH.balanceOf(depositManager), val / 2n);
            expectEqual(await cWETHv3.balanceOf(depositManager), val / 2n);

            // Second deposit
            await tokenVaultWETH.requestDeposit(val, owner, owner);
            expect(await aWETH.balanceOf(depositManager)).to.be.greaterThan(val);
            expect(await cWETHv3.balanceOf(depositManager)).to.be.greaterThan(val);

            // Verify shares and assets
            let userShares = await rebaseTokenV2.sharesOf(owner);
            expect(userShares).to.be.lessThanOrEqual(val * 2n);
            expect(await rebaseTokenV2.convertToAssets(userShares)).to.be.greaterThanOrEqual(
                2n * val,
            );

            // Generate validator keys for staking
            const { pubkey, signature, depositDataRoot } = createValidatorKeys(
                defaultWithdrawalCredentials,
            );

            // Large deposit to prepare for staking
            await tokenVaultWETH.requestDeposit(val * 30n, owner, owner);
            expect(await aWETH.balanceOf(depositManager)).to.be.greaterThanOrEqual(val * 16n);
            expect(await cWETHv3.balanceOf(depositManager)).to.be.greaterThanOrEqual(val * 16n);

            // Perform staking operation
            await depositManager.stakeNative(val * 32n, pubkey, signature, depositDataRoot);

            // Verify final balances after staking
            expect(await aWETH.balanceOf(depositManager)).to.be.lessThan(val * 16n);
            expect(await cWETHv3.balanceOf(depositManager)).to.be.lessThan(val * 16n);
            expect(await aWETH.balanceOf(depositManager)).to.be.greaterThan(0n);
            expect(await cWETHv3.balanceOf(depositManager)).to.be.greaterThan(0n);
            userShares = await rebaseTokenV2.sharesOf(owner);
            expect(userShares).to.be.lessThan(val * 32n);
        });

        it('Should successfully handle pause and unpause operations', async () => {
            const { depositManager, tokenVaultWETH, owner, defaultWithdrawalCredentials } =
                await loadFixture(deployMrETh);

            // Test deposit value of 32 WETH
            const val = 32n * 10n ** 18n;

            // Initial deposit
            await tokenVaultWETH.requestDeposit(val, owner, owner);

            // Pause staking
            await depositManager.pauseStake();

            // Generate validator keys
            const { pubkey, signature, depositDataRoot } = createValidatorKeys(
                defaultWithdrawalCredentials,
            );

            // Attempt staking while paused (should fail)
            await expect(depositManager.stakeNative(val, pubkey, signature, depositDataRoot)).to.be
                .reverted;

            // Unpause staking
            await depositManager.unpauseStake();

            // Successful staking after unpause
            await depositManager.stakeNative(val, pubkey, signature, depositDataRoot);
        });

        it('Should successfully remove pool from buffer', async () => {
            const {
                user0,
                depositManager,
                tokenVaultWETH,
                owner,
                WETH,
                aWETH,
                cWETHv3,
                aavePool,
                aaveBufferLib,
                compoundBufferLib,
            } = await loadFixture(deployMrETh);

            // Initial pool configuration with equal portions
            const setPoolData1 = [
                {
                    pool: aavePool,
                    newPoolData: {
                        poolToken: aWETH,
                        poolLib: aaveBufferLib,
                        poolPortion: 5_000n, // 50%
                        poolId: 0,
                    },
                    auth: true,
                },
                {
                    pool: cWETHv3,
                    newPoolData: {
                        poolToken: cWETHv3,
                        poolLib: compoundBufferLib,
                        poolPortion: 5_000n, // 50%
                        poolId: 1,
                    },
                    auth: true,
                },
            ];

            // Set up initial pools
            await depositManager.setPools(setPoolData1, 2);

            // Test deposit value of 1 WETH
            const val = 1n * 10n ** 18n;

            // Verify initial balance
            expect(await WETH.balanceOf(owner)).to.be.greaterThan(val * 3n);

            // Perform deposit and verify equal distribution
            await tokenVaultWETH.requestDeposit(2n * val, owner, owner);
            expectEqual(await aWETH.balanceOf(depositManager), val);
            expectEqual(await cWETHv3.balanceOf(depositManager), val);

            const setPoolData2 = [
                {
                    pool: aavePool,
                    newPoolData: {
                        poolToken: aWETH,
                        poolLib: aaveBufferLib,
                        poolPortion: 10_000n, // 50%
                        poolId: 0,
                    },
                    auth: true,
                },
                {
                    pool: cWETHv3,
                    newPoolData: {
                        poolToken: cWETHv3,
                        poolLib: compoundBufferLib,
                        poolPortion: 0, // 0%
                        poolId: 1,
                    },
                    auth: false,
                },
            ];

            // Update pool configuration
            await depositManager.setPools(setPoolData2, 1);

            // Verify final balances
            expect(await aWETH.balanceOf(depositManager)).to.be.greaterThan(val * 2n);
            expect(await cWETHv3.balanceOf(depositManager)).to.be.equal(0n);

            const setPoolData3 = [
                {
                    pool: aavePool,
                    newPoolData: {
                        poolToken: aWETH,
                        poolLib: aaveBufferLib,
                        poolPortion: 10_000n, // 50%
                        poolId: 0,
                    },
                    auth: true,
                },
                {
                    pool: cWETHv3,
                    newPoolData: {
                        poolToken: cWETHv3,
                        poolLib: compoundBufferLib,
                        poolPortion: 0, // 0%
                        poolId: 1,
                    },
                    auth: true,
                },
            ];

            // Test revert for incorrect data
            await expect(
                depositManager.connect(user0).setPools(setPoolData3, 2),
            ).to.be.rejectedWith('OwnableUnauthorizedAccount(');
        });

        it('Should correctly calculate pool portions to withdraw', async () => {
            const {
                depositManager,
                tokenVaultWETH,
                owner,
                WETH,
                aWETH,
                cWETHv3,
                aavePool,
                aaveBufferLib,
                compoundBufferLib,
                defaultWithdrawalCredentials,
            } = await loadFixture(deployMrETh);

            // Configure pools with equal portions
            const setPoolData = [
                {
                    pool: aavePool,
                    newPoolData: {
                        poolToken: aWETH,
                        poolLib: aaveBufferLib,
                        poolPortion: 5_000n, // 50%
                        poolId: 0,
                    },
                    auth: true,
                },
                {
                    pool: cWETHv3,
                    newPoolData: {
                        poolToken: cWETHv3,
                        poolLib: compoundBufferLib,
                        poolPortion: 5_000n, // 50%
                        poolId: 1,
                    },
                    auth: true,
                },
            ];

            // Set up pools
            await depositManager.setPools(setPoolData, 2);

            // Test deposit value of 1 WETH
            const val = 1n * 10n ** 18n;

            // Verify initial balance
            expect(await WETH.balanceOf(owner)).to.be.greaterThanOrEqual(val * 64n);

            // Perform large deposit
            await tokenVaultWETH.requestDeposit(val * 64n, owner, owner);
            expectEqual(await aWETH.balanceOf(depositManager), (val * 64n) / 2n);
            expectEqual(await cWETHv3.balanceOf(depositManager), (val * 64n) / 2n);

            // Simulate time passage (2 years)
            await network.provider.send('evm_increaseTime', [years(2)]);
            await network.provider.send('evm_mine');

            // Generate validator keys
            const { pubkey, signature, depositDataRoot } = createValidatorKeys(
                defaultWithdrawalCredentials,
            );

            // Perform staking operation
            await depositManager.stakeNative(val * 32n, pubkey, signature, depositDataRoot);

            // Verify final balances are equal
            expectEqual(
                await aWETH.balanceOf(depositManager),
                await cWETHv3.balanceOf(depositManager),
            );
        });

        it('Should successfully rebalance buffer', async () => {
            const {
                depositManager,
                tokenVaultWETH,
                owner,
                WETH,
                aWETH,
                cWETHv3,
                aavePool,
                aaveBufferLib,
                compoundBufferLib,
            } = await loadFixture(deployMrETh);

            // Incorrect initial pool configuration with incorrect portions
            const wrongSetPoolData = [
                {
                    pool: aavePool,
                    newPoolData: {
                        poolToken: aWETH,
                        poolLib: aaveBufferLib,
                        poolPortion: 3_001n, // 30%
                        poolId: 0,
                    },
                    auth: true,
                },
                {
                    pool: cWETHv3,
                    newPoolData: {
                        poolToken: cWETHv3,
                        poolLib: compoundBufferLib,
                        poolPortion: 7_000n, // 70%
                        poolId: 1,
                    },
                    auth: true,
                },
            ];

            await expect(depositManager.setPools(wrongSetPoolData, 2)).to.be.rejectedWith(
                'EWrongPortion()',
            );

            const setPoolData1 = [
                {
                    pool: aavePool,
                    newPoolData: {
                        poolToken: aWETH,
                        poolLib: aaveBufferLib,
                        poolPortion: 3_000n, // 30%
                        poolId: 0,
                    },
                    auth: true,
                },
                {
                    pool: cWETHv3,
                    newPoolData: {
                        poolToken: cWETHv3,
                        poolLib: compoundBufferLib,
                        poolPortion: 7_000n, // 70%
                        poolId: 1,
                    },
                    auth: true,
                },
            ];

            // Set up initial pools
            await depositManager.setPools(setPoolData1, 2);

            // Test deposit value of 1 WETH
            const val = 64n * 10n ** 18n;

            // Verify initial balance
            expect(await WETH.balanceOf(owner)).to.be.greaterThanOrEqual(val);

            // Perform large deposit
            await tokenVaultWETH.requestDeposit(val, owner, owner);
            expectEqual(await aWETH.balanceOf(depositManager), (val * 30n) / 100n); // 30%
            expectEqual(await cWETHv3.balanceOf(depositManager), (val * 70n) / 100n); // 70%

            // Simulate time passage (2 years)
            await network.provider.send('evm_increaseTime', [years(2)]);
            await network.provider.send('evm_mine');

            // New pool configuration with equal portions
            const newPoolsData = [
                {
                    poolToken: aWETH,
                    poolLib: aaveBufferLib,
                    poolPortion: 5_000n, // 50%
                    poolId: 0,
                },
                {
                    poolToken: cWETHv3,
                    poolLib: compoundBufferLib,
                    poolPortion: 5_000n, // 50%
                    poolId: 1,
                },
            ];

            // Perform rebalance operation
            await depositManager.rebalanceBuffer(newPoolsData);

            // Verify final balances are equal
            expectEqual(
                await aWETH.balanceOf(depositManager),
                await cWETHv3.balanceOf(depositManager),
            );
        });

        it('Should successfully choose operator to keep delegation proportion', async () => {
            const {
                user0,
                depositManager,
                tokenVaultWETH,
                tokenVaultStETH,
                owner,
                WETH,
                stETH,
                defaultOperator,
                defaultWithdrawalCredentials,
            } = await loadFixture(deployMrETh);

            // Test deposit value of 1 WETH
            const val = 1n * 10n ** 18n;

            // Verify initial balance
            expect(await WETH.balanceOf(owner)).to.be.greaterThanOrEqual(val * 96n);
            expect(await stETH.balanceOf(owner)).to.be.greaterThanOrEqual(val * 64n);

            // Add more operators
            const operator2 = '0x71c6f7ed8c2d4925d0baf16f6a85bb1736d412eb';
            const operator3 = '0x4cd2086e1d708e65db5d4f5712a9ca46ed4bbd0a';

            await depositManager.addOperator(
                operator2,
                '0x0000000000000000000000000000000000000000000000000000000000000001',
                APPROVER_SIGNATURE_AND_EXPIRY,
                APPROVER_SALT,
                [defaultOperator, operator2],
                [7_000n, 3_000n],
            );

            await expect(
                depositManager.addOperator(
                    operator2,
                    '0x0000000000000000000000000000000000000000000000000000000000000001',
                    APPROVER_SIGNATURE_AND_EXPIRY,
                    APPROVER_SALT,
                    [defaultOperator, operator2],
                    [7_000n, 3_000n],
                ),
            ).to.be.rejectedWith('EOperatorExists()');

            await expect(
                depositManager.addOperator(
                    operator3,
                    '0x0000000000000000000000000000000000000000000000000000000000000001',
                    APPROVER_SIGNATURE_AND_EXPIRY,
                    APPROVER_SALT,
                    [defaultOperator, operator2, operator3],
                    [5_000n, 3_000n, 2_000n],
                ),
            ).to.be.rejectedWith('EContractAlreadyExists()');

            await expect(
                depositManager.addOperator(
                    ethers.ZeroAddress,
                    '0x0000000000000000000000000000000000000000000000000000000000000002',
                    APPROVER_SIGNATURE_AND_EXPIRY,
                    APPROVER_SALT,
                    [defaultOperator, operator2, operator3],
                    [5_000n, 3_000n, 2_000n],
                ),
            ).to.be.rejectedWith('EZeroAddress()');

            await depositManager.addOperator(
                operator3,
                '0x0000000000000000000000000000000000000000000000000000000000000002',
                APPROVER_SIGNATURE_AND_EXPIRY,
                APPROVER_SALT,
                [defaultOperator, operator2, operator3],
                [5_000n, 3_000n, 2_000n],
            );

            // Perform large deposit
            await tokenVaultWETH.requestDeposit(val * 96n, owner, owner);

            let restakeData = await depositManager.totalRestakedSupply();
            const operatorTVLs1 = restakeData.operatorDelegatorTVLs;
            expectEqual(restakeData.restakedTvl, 0n);
            expectEqual(operatorTVLs1[0]!, 0n);
            expectEqual(operatorTVLs1[1]!, 0n);
            expectEqual(operatorTVLs1[2]!, 0n);

            // Generate validator keys
            const { pubkey, signature, depositDataRoot } = createValidatorKeys(
                defaultWithdrawalCredentials,
            );

            // Perform staking operation
            await depositManager.stakeNative(val * 32n, pubkey, signature, depositDataRoot);

            restakeData = await depositManager.totalRestakedSupply();
            const operatorTVLs2 = restakeData.operatorDelegatorTVLs;
            expectEqual(restakeData.restakedTvl, val * 32n);
            expectEqual(operatorTVLs2[0]!, val * 32n);
            expectEqual(operatorTVLs2[1]!, 0n);
            expectEqual(operatorTVLs2[2]!, 0n);

            let choosenDelegatorAddress = await depositManager.chooseDelegatorForDeposit();
            let delegatorWithdrawalCredentials =
                await depositManager.getWithdrawalCredentials(choosenDelegatorAddress);

            const {
                pubkey: pubkey2,
                signature: signature2,
                depositDataRoot: depositDataRoot2,
            } = createValidatorKeys(delegatorWithdrawalCredentials);

            // Perform staking operation
            await depositManager.stakeNative(val * 32n, pubkey2, signature2, depositDataRoot2);

            restakeData = await depositManager.totalRestakedSupply();
            const operatorTVLs3 = restakeData.operatorDelegatorTVLs;
            expectEqual(restakeData.restakedTvl, val * 64n);
            expectEqual(operatorTVLs3[0]!, val * 32n);
            expectEqual(operatorTVLs3[1]!, val * 32n);
            expectEqual(operatorTVLs3[2]!, 0n);

            choosenDelegatorAddress = await depositManager.chooseDelegatorForDeposit();
            delegatorWithdrawalCredentials =
                await depositManager.getWithdrawalCredentials(choosenDelegatorAddress);

            const {
                pubkey: pubkey3,
                signature: signature3,
                depositDataRoot: depositDataRoot3,
            } = createValidatorKeys(delegatorWithdrawalCredentials);

            // Perform staking operation
            await depositManager.stakeNative(val * 32n, pubkey3, signature3, depositDataRoot3);

            restakeData = await depositManager.totalRestakedSupply();
            const operatorTVLs4 = restakeData.operatorDelegatorTVLs;
            expectEqual(restakeData.restakedTvl, val * 96n);
            expectEqual(operatorTVLs4[0]!, val * 32n);
            expectEqual(operatorTVLs4[1]!, val * 32n);
            expectEqual(operatorTVLs4[2]!, val * 32n);

            // Perform deposit request
            await tokenVaultStETH.connect(owner).requestDeposit(val * 34n, owner, owner);

            restakeData = await depositManager.totalRestakedSupply();
            const operatorTVLs5 = restakeData.operatorDelegatorTVLs;
            expectEqual(restakeData.restakedTvl, val * 130n);
            expectEqual(operatorTVLs5[0]!, val * 66n);
            expectEqual(operatorTVLs5[1]!, val * 32n);
            expectEqual(operatorTVLs5[2]!, val * 32n);

            // Perform deposit request
            await tokenVaultStETH.connect(owner).requestDeposit(val * 8n, owner, owner);

            restakeData = await depositManager.totalRestakedSupply();
            const operatorTVLs6 = restakeData.operatorDelegatorTVLs;
            expectEqual(restakeData.restakedTvl, val * 138n);
            expectEqual(operatorTVLs6[0]!, val * 66n);
            expectEqual(operatorTVLs6[1]!, val * 40n);
            expectEqual(operatorTVLs6[2]!, val * 32n);

            // Rebalance operator's portions reverts for incorrect data
            await expect(
                depositManager.setOperatorsPortions(
                    [defaultOperator, operator2, operator3],
                    [5_000n, 2_000n],
                ),
            ).to.be.rejectedWith('EIncorrectLength()');
            await expect(
                depositManager.setOperatorsPortions(
                    [defaultOperator, operator2],
                    [5_000n, 2_000n, 3_000n],
                ),
            ).to.be.rejectedWith('EIncorrectLength()');
            await expect(
                depositManager.setOperatorsPortions(
                    [defaultOperator, operator2, operator3],
                    [5_000n, 2_000n, 3_001n],
                ),
            ).to.be.rejectedWith('EWrongPortion()');
            await expect(
                depositManager
                    .connect(user0)
                    .setOperatorsPortions(
                        [defaultOperator, operator2, operator3],
                        [5_000n, 2_000n, 3_001n],
                    ),
            ).to.be.rejectedWith('OwnableUnauthorizedAccount(');

            await expect(
                depositManager.removeOperator(
                    operator2,
                    [defaultOperator, operator3],
                    [5_000n, 5_000n],
                ),
            ).to.be.rejectedWith('EDelegatorHasActiveStake()');
        });

        it('Should successfully update yield for WETH', async () => {
            const {
                depositManager,
                rebaseTokenV2,
                tokenVaultWETH,
                owner,
                WETH,
                aWETH,
                defaultOperator,
                defaultWithdrawalCredentials,
            } = await loadFixture(deployMrETh);

            // Test deposit value of 1 WETH (18 decimals)
            const val = 1n * 10n ** 18n;

            // Create mock yield rewards amount
            const mockRewardsAmount = 10n ** 18n;

            // Verify initial balances
            expect(await WETH.balanceOf(owner)).to.be.greaterThan(val * 32n);
            expect(await aWETH.balanceOf(depositManager)).to.be.equal(0n);

            // First deposit request
            await tokenVaultWETH.connect(owner).requestDeposit(val, owner, owner);

            // Verify shares and balances after first deposit
            let userShares = await rebaseTokenV2.sharesOf(owner);

            expectEqual(await aWETH.balanceOf(depositManager), val);

            expectEqual(userShares, val);
            expectEqual(await rebaseTokenV2.convertToAssets(userShares), val);

            // Second deposit request
            await tokenVaultWETH.requestDeposit(val, owner, owner);

            // Verify balances after second deposit
            expect(await aWETH.balanceOf(depositManager)).to.be.greaterThanOrEqual(val * 2n);
            userShares = await rebaseTokenV2.sharesOf(owner);
            expect(userShares).to.be.lessThanOrEqual(val * 2n);
            expect(await rebaseTokenV2.convertToAssets(userShares)).to.be.greaterThanOrEqual(
                val * 2n,
            );

            // Generate validator keys for staking
            const { pubkey, signature, depositDataRoot } = createValidatorKeys(
                defaultWithdrawalCredentials,
            );

            // Large deposit request to prepare for staking
            await tokenVaultWETH.requestDeposit(val * 30n, owner, owner);
            expect(await aWETH.balanceOf(depositManager)).to.be.greaterThanOrEqual(val * 32n);

            // Perform staking operation
            await depositManager.stakeNative(val * 32n, pubkey, signature, depositDataRoot);

            // Verify final balances after staking
            expect(await aWETH.balanceOf(depositManager)).to.be.lessThan(val * 32n);
            expect(await aWETH.balanceOf(depositManager)).to.be.greaterThan(0n);

            userShares = await rebaseTokenV2.sharesOf(owner);
            expect(userShares).to.be.lessThan(val * 32n);

            // Create mock RewardsMerkleClaim data with all zeros
            const mockRewardsClaim = {
                rootIndex: 0,
                earnerIndex: 0,
                earnerTreeProof: '0x',
                earnerLeaf: {
                    earner: ethers.ZeroAddress,
                    earnerTokenRoot: APPROVER_SALT,
                },
                tokenIndices: [],
                tokenTreeProofs: [],
                tokenLeaves: [
                    {
                        token: WETH,
                        cumulativeEarnings: mockRewardsAmount,
                    },
                ],
            };

            await depositManager.claimRewardsAndRestake(defaultOperator, mockRewardsClaim);

            expect(await depositManager.totalSupply()).to.be.greaterThan(
                val * 32n + mockRewardsAmount,
            );
            expect(await depositManager.totalBufferedSupply()).to.be.greaterThan(mockRewardsAmount);
        });

        it('Should successfully update yield for stETH', async () => {
            const {
                depositManager,
                defaultOperator,
                rebaseTokenV2,
                tokenVaultStETH,
                owner,
                aWETH,
                stETH,
            } = await loadFixture(deployMrETh);

            // Test deposit value of 1 WETH
            const val = 1n * 10n ** 18n;

            // Create mock yield rewards amount
            const mockRewardsAmount = 10n ** 18n;

            // Verify initial balances
            expect(await stETH.balanceOf(owner)).to.be.greaterThan(val * 2n);
            expect(await aWETH.balanceOf(depositManager)).to.be.equal(0n);

            // Perform deposit request
            await tokenVaultStETH.connect(owner).requestDeposit(val, owner, owner);

            // Verify shares and balances after deposit
            const userShares = await rebaseTokenV2.sharesOf(owner);
            expectEqual(userShares, val);
            expectEqual(await rebaseTokenV2.convertToAssets(userShares), val);
            expectEqual(await depositManager.totalSupply(), val);

            // Create mock RewardsMerkleClaim data with all zeros
            const mockRewardsClaim = {
                rootIndex: 0,
                earnerIndex: 0,
                earnerTreeProof: '0x',
                earnerLeaf: {
                    earner: ethers.ZeroAddress,
                    earnerTokenRoot: APPROVER_SALT,
                },
                tokenIndices: [],
                tokenTreeProofs: [],
                tokenLeaves: [
                    {
                        token: stETH,
                        cumulativeEarnings: mockRewardsAmount,
                    },
                ],
            };

            await depositManager.claimRewardsAndRestake(defaultOperator, mockRewardsClaim);

            expectEqual(await depositManager.totalSupply(), val + mockRewardsAmount);
            expectEqual(
                (await depositManager.totalRestakedSupply()).restakedTvl,
                val + mockRewardsAmount,
            );
        });
        it('Should revert by access control in Delegator contract', async () => {
            const { depositManager, WETH, defaultWithdrawalCredentials, defaultOperator } =
                await loadFixture(deployMrETh);

            const delegator = await ethers.getContractAt(
                'Delegator',
                (await depositManager.operatorsDelegators(defaultOperator)).delegator,
            );

            // Generate validator keys for staking
            const { pubkey, signature, depositDataRoot } = createValidatorKeys(
                defaultWithdrawalCredentials,
            );

            await expect(
                delegator.stakeNative(pubkey, signature, depositDataRoot),
            ).to.be.rejectedWith('ENotAuthorized()');

            await expect(
                delegator.stakeToken(ethers.ZeroAddress, ethers.ZeroAddress, 1n),
            ).to.be.rejectedWith('ENotAuthorized()');

            await expect(
                delegator.verifyWithdrawalCredentials(
                    1n,
                    {
                        beaconStateRoot: APPROVER_SALT,
                        proof: APPROVER_SALT,
                    },
                    [1n],
                    [APPROVER_SALT],
                    [[APPROVER_SALT, APPROVER_SALT]],
                ),
            ).to.be.rejectedWith('ENotAuthorized()');

            await expect(delegator.startCheckpoint()).to.be.rejectedWith('ENotAuthorized()');

            await expect(
                delegator.redelegate(defaultOperator, APPROVER_SIGNATURE_AND_EXPIRY, APPROVER_SALT),
            ).to.be.rejectedWith('ENotAuthorized()');

            const mockRewardsClaim = {
                rootIndex: 0,
                earnerIndex: 0,
                earnerTreeProof: '0x',
                earnerLeaf: {
                    earner: ethers.ZeroAddress,
                    earnerTokenRoot: APPROVER_SALT,
                },
                tokenIndices: [],
                tokenTreeProofs: [],
                tokenLeaves: [
                    {
                        token: WETH,
                        cumulativeEarnings: 1n,
                    },
                ],
            };

            await expect(delegator.claimRewards(mockRewardsClaim)).to.be.rejectedWith(
                'ENotAuthorized()',
            );

            await expect(
                delegator.verifyCheckpointProofs(
                    {
                        balanceContainerRoot: APPROVER_SALT,
                        proof: APPROVER_SALT,
                    },
                    [
                        {
                            pubkeyHash: APPROVER_SALT,
                            balanceRoot: APPROVER_SALT,
                            proof: APPROVER_SALT,
                        },
                    ],
                ),
            ).to.be.rejectedWith('ENotAuthorized()');

            await expect(
                delegator.initialize(
                    depositManager,
                    depositManager,
                    depositManager,
                    APPROVER_SIGNATURE_AND_EXPIRY,
                    APPROVER_SALT,
                ),
            ).to.be.rejectedWith('InvalidInitialization()');
        });

        it('Should revert restake functionalityin DepositManager contract', async () => {
            const { user0, depositManager, WETH, defaultWithdrawalCredentials, defaultOperator } =
                await loadFixture(deployMrETh);

            await expect(depositManager.deposit(1, WETH, ethers.ZeroAddress, 1)).to.be.rejectedWith(
                'ENotAuthorized()',
            );

            await expect(
                depositManager.depositNativeToken(1, WETH, ethers.ZeroAddress, 1, { value: 1n }),
            ).to.be.rejectedWith('ENotAuthorized()');

            // Generate validator keys for staking
            const { pubkey, signature, depositDataRoot } = createValidatorKeys(
                defaultWithdrawalCredentials,
            );

            await expect(
                depositManager.connect(user0).stakeNative(1, pubkey, signature, depositDataRoot),
            ).to.be.rejectedWith('ENotAuthorized()');
            await expect(
                depositManager.stakeNative(1, pubkey, signature, depositDataRoot),
            ).to.be.rejectedWith('ETooHighDepositValue()');

            await expect(
                depositManager.verifyWithdrawalCredentials(
                    defaultOperator,
                    1n,
                    {
                        beaconStateRoot: APPROVER_SALT,
                        proof: APPROVER_SALT,
                    },
                    [1n],
                    [APPROVER_SALT],
                    [[APPROVER_SALT, APPROVER_SALT]],
                ),
            ).to.be.rejectedWith('EIncorrectRestakeAmount()');

            await expect(
                depositManager.connect(user0).verifyWithdrawalCredentials(
                    defaultOperator,
                    1n,
                    {
                        beaconStateRoot: APPROVER_SALT,
                        proof: APPROVER_SALT,
                    },
                    [1n],
                    [APPROVER_SALT],
                    [[APPROVER_SALT, APPROVER_SALT]],
                ),
            ).to.be.rejectedWith('ENotAuthorized()');

            await expect(
                depositManager.connect(user0).startCheckpoint(defaultOperator),
            ).to.be.rejectedWith('ENotAuthorized()');
            await expect(depositManager.startCheckpoint(defaultOperator)).to.be.reverted;

            await expect(
                depositManager.connect(user0).verifyCheckpointProofs(
                    defaultOperator,
                    {
                        balanceContainerRoot: APPROVER_SALT,
                        proof: APPROVER_SALT,
                    },
                    [
                        {
                            pubkeyHash: APPROVER_SALT,
                            balanceRoot: APPROVER_SALT,
                            proof: APPROVER_SALT,
                        },
                    ],
                ),
            ).to.be.rejectedWith('ENotAuthorized()');

            await expect(
                depositManager.verifyCheckpointProofs(
                    defaultOperator,
                    {
                        balanceContainerRoot: APPROVER_SALT,
                        proof: APPROVER_SALT,
                    },
                    [
                        {
                            pubkeyHash: APPROVER_SALT,
                            balanceRoot: APPROVER_SALT,
                            proof: APPROVER_SALT,
                        },
                    ],
                ),
            ).to.be.reverted;

            // Create mock RewardsMerkleClaim data with all zeros
            const mockRewardsClaim = {
                rootIndex: 0,
                earnerIndex: 0,
                earnerTreeProof: '0x',
                earnerLeaf: {
                    earner: ethers.ZeroAddress,
                    earnerTokenRoot: APPROVER_SALT,
                },
                tokenIndices: [],
                tokenTreeProofs: [],
                tokenLeaves: [
                    {
                        token: WETH,
                        cumulativeEarnings: 1,
                    },
                ],
            };

            await expect(
                depositManager.connect(user0).claimRewards(defaultOperator, mockRewardsClaim),
            ).to.be.rejectedWith('ENotAuthorized()');
            await expect(
                depositManager
                    .connect(user0)
                    .claimRewardsAndRestake(defaultOperator, mockRewardsClaim),
            ).to.be.rejectedWith('ENotAuthorized()');

            await expect(
                depositManager.connect(user0).restakeRewards([defaultOperator], [1]),
            ).to.be.rejectedWith('ENotAuthorized()');

            await expect(
                depositManager
                    .connect(user0)
                    .redelegate(
                        defaultOperator,
                        defaultOperator,
                        APPROVER_SIGNATURE_AND_EXPIRY,
                        APPROVER_SALT,
                    ),
            ).to.be.rejectedWith('ENotAuthorized()');

            await expect(
                depositManager.redelegate(
                    defaultOperator,
                    defaultOperator,
                    APPROVER_SIGNATURE_AND_EXPIRY,
                    APPROVER_SALT,
                ),
            ).to.be.reverted;

            await expect(
                depositManager.connect(user0).restakeRewards([defaultOperator], [1]),
            ).to.be.rejectedWith('ENotAuthorized()');
        });

        it('Should revert setters functionality in DepositManager contract', async () => {
            const {
                owner,
                user0,
                depositManager,
                aWETH,
                defaultOperator,
                cWETHv3,
                aaveBufferLib,
                compoundBufferLib,
            } = await loadFixture(deployMrETh);

            await expect(depositManager.addTokenVault(ethers.ZeroAddress)).to.be.rejectedWith(
                'ENotAuthorized()',
            );
            await expect(depositManager.removeTokenVault(ethers.ZeroAddress)).to.be.rejectedWith(
                'ENotAuthorized()',
            );
            await expect(depositManager.connect(user0).setBufferPercentage(1)).to.be.rejectedWith(
                'OwnableUnauthorizedAccount(',
            );
            await expect(depositManager.setBufferPercentage(10_001n)).to.be.rejectedWith(
                'EInvalidPercentage()',
            );
            await depositManager.setBufferPercentage(1n);

            await expect(
                depositManager.connect(user0).setDelegatorImplementation(ethers.ZeroAddress),
            ).to.be.rejectedWith('OwnableUnauthorizedAccount(');
            await expect(
                depositManager.setDelegatorImplementation(ethers.ZeroAddress),
            ).to.be.rejectedWith('EZeroAddress()');
            await depositManager.setDelegatorImplementation(depositManager);

            await expect(
                depositManager.connect(user0).setAuthorizedStaker(ethers.ZeroAddress),
            ).to.be.rejectedWith('OwnableUnauthorizedAccount(');
            await expect(depositManager.setAuthorizedStaker(ethers.ZeroAddress)).to.be.rejectedWith(
                'EZeroAddress()',
            );
            await depositManager.setAuthorizedStaker(owner);

            // New pool configuration with equal portions
            const newPoolsData = [
                {
                    poolToken: aWETH,
                    poolLib: aaveBufferLib,
                    poolPortion: 5_000n, // 50%
                    poolId: 0,
                },
                {
                    poolToken: cWETHv3,
                    poolLib: compoundBufferLib,
                    poolPortion: 5_000n, // 50%
                    poolId: 1,
                },
            ];

            // Perform rebalance operation
            await expect(
                depositManager.connect(user0).rebalanceBuffer(newPoolsData),
            ).to.be.rejectedWith('OwnableUnauthorizedAccount(');

            await depositManager.grantNativeToken(ethers.ZeroAddress, 1);
            await depositManager.requestRedeem(1, ethers.ZeroAddress, 1);

            await expect(
                depositManager.addStrategies(
                    [ethers.ZeroAddress],
                    [ethers.ZeroAddress],
                    [ethers.ZeroAddress],
                ),
            ).to.be.rejectedWith('EZeroAddress()');

            await expect(
                depositManager.addStrategies(
                    [ethers.ZeroAddress, ethers.ZeroAddress],
                    [ethers.ZeroAddress],
                    [ethers.ZeroAddress],
                ),
            ).to.be.rejectedWith('EIncorrectLength()');

            await expect(
                depositManager
                    .connect(user0)
                    .addStrategies(
                        [ethers.ZeroAddress],
                        [ethers.ZeroAddress],
                        [ethers.ZeroAddress],
                    ),
            ).to.be.rejectedWith('OwnableUnauthorizedAccount(');

            // pausable functionality test
            // Pause staking
            await expect(depositManager.connect(user0).pauseStake()).to.be.rejectedWith(
                'ENotAuthorizedForPause()',
            );
            await expect(depositManager.connect(user0).unpauseStake()).to.be.rejectedWith(
                'OwnableUnauthorizedAccount(',
            );
            await depositManager.pauseStake();
            await expect(depositManager.pauseStake()).to.be.rejectedWith('EPauseAlreadySet()');

            await expect(
                depositManager.verifyWithdrawalCredentials(
                    defaultOperator,
                    1n,
                    {
                        beaconStateRoot: APPROVER_SALT,
                        proof: APPROVER_SALT,
                    },
                    [1n],
                    [APPROVER_SALT],
                    [[APPROVER_SALT, APPROVER_SALT]],
                ),
            ).to.be.rejectedWith('EStakePaused()');

            await expect(
                depositManager.redelegate(
                    defaultOperator,
                    defaultOperator,
                    APPROVER_SIGNATURE_AND_EXPIRY,
                    APPROVER_SALT,
                ),
            ).to.be.rejectedWith('EStakePaused()');

            await expect(
                depositManager.connect(user0).transferOwnership(ethers.ZeroAddress),
            ).to.be.rejectedWith('OwnableUnauthorizedAccount(');
            await depositManager.transferOwnership(ethers.ZeroAddress);
        });

        it('Should successfully calculate available amount to deposit into AAVE and Compound', async () => {
            const { depositManager, aWETH, cWETHv3, aavePool, aaveBufferLib, compoundBufferLib } =
                await loadFixture(deployMrETh);

            // Test with initial single pool configuration
            const availableData = await depositManager.getAvailableAmountToDeposit();

            expect(availableData.totalAvailableAmount).to.be.greaterThanOrEqual(0n);
            expect(availableData.availableAmounts.length).to.be.equal(1);
            expect(availableData.availableAmounts[0]).to.be.greaterThanOrEqual(0n);

            // Initial pool configuration with uneven portions
            const setPoolData = [
                {
                    pool: aavePool,
                    newPoolData: {
                        poolToken: aWETH,
                        poolLib: aaveBufferLib,
                        poolPortion: 3_000n, // 30%
                        poolId: 0,
                    },
                    auth: true,
                },
                {
                    pool: cWETHv3,
                    newPoolData: {
                        poolToken: cWETHv3,
                        poolLib: compoundBufferLib,
                        poolPortion: 7_000n, // 70%
                        poolId: 1,
                    },
                    auth: true,
                },
            ];

            // Set up pools in the deposit manager
            await depositManager.setPools(setPoolData, 2);

            // Test with two pools configuration
            let availableDataAfterSetup = await depositManager.getAvailableAmountToDeposit();

            expect(availableDataAfterSetup.totalAvailableAmount).to.be.greaterThanOrEqual(
                ethers.MaxUint256,
            );
            expect(availableDataAfterSetup.availableAmounts.length).to.be.equal(2);
            expect(availableDataAfterSetup.availableAmounts[0]).to.be.greaterThanOrEqual(0n);
            expect(availableDataAfterSetup.availableAmounts[1]).to.be.equal(ethers.MaxUint256);

            // Data for remove aave pool in the deposit manager
            const setPoolData1 = [
                {
                    pool: aavePool,
                    newPoolData: {
                        poolToken: aWETH,
                        poolLib: aaveBufferLib,
                        poolPortion: 0n, // 0%
                        poolId: 0,
                    },
                    auth: false,
                },
                {
                    pool: cWETHv3,
                    newPoolData: {
                        poolToken: cWETHv3,
                        poolLib: compoundBufferLib,
                        poolPortion: 10_000n, // 100%
                        poolId: 0,
                    },
                    auth: true,
                },
            ];

            await expect(depositManager.setPools(setPoolData1, 2)).to.be.rejectedWith(
                'EIncorrectExpectedPoolLength()',
            );

            await expect(depositManager.setPools(setPoolData1, 3)).to.be.rejectedWith(
                'EIncorrectLength()',
            );

            // Remove aave pool in the deposit manager
            await depositManager.setPools(setPoolData1, 1);

            const setPoolData2 = [
                {
                    pool: cWETHv3,
                    newPoolData: {
                        poolToken: cWETHv3,
                        poolLib: compoundBufferLib,
                        poolPortion: 7_000n, // 70%
                        poolId: 0,
                    },
                    auth: true,
                },
                {
                    pool: aavePool,
                    newPoolData: {
                        poolToken: aWETH,
                        poolLib: aaveBufferLib,
                        poolPortion: 3_000n, // 30%
                        poolId: 1,
                    },
                    auth: true,
                },
            ];

            // Set up pools in the deposit manager
            await depositManager.setPools(setPoolData2, 2);

            // Test with two pools configuration
            availableDataAfterSetup = await depositManager.getAvailableAmountToDeposit();

            expect(availableDataAfterSetup.totalAvailableAmount).to.be.equal(ethers.MaxUint256);
            expect(availableDataAfterSetup.availableAmounts.length).to.be.equal(2);
            expect(availableDataAfterSetup.availableAmounts[0]).to.be.equal(ethers.MaxUint256);
            expect(availableDataAfterSetup.availableAmounts[1]).to.be.greaterThanOrEqual(0n);
        });
    });
});
