/* eslint-disable camelcase, max-lines */
import { years } from '@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time/duration';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import { network } from 'hardhat';

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
            const newPoolsData = [
                {
                    poolToken: await aWETH.getAddress(),
                    poolLib: await aaveBufferLib.getAddress(),
                    poolPortion: 5_000n, // 50%
                    poolId: 0,
                },
                {
                    poolToken: await cWETHv3.getAddress(),
                    poolLib: await compoundBufferLib.getAddress(),
                    poolPortion: 5_000n, // 50%
                    poolId: 1,
                },
            ];

            // Set up pools in the deposit manager
            await depositManager.setPools([aavePool, await cWETHv3.getAddress()], newPoolsData, [
                true,
                true,
            ]);

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
            const newPoolsData1 = [
                {
                    poolToken: await aWETH.getAddress(),
                    poolLib: await aaveBufferLib.getAddress(),
                    poolPortion: 5_000n, // 50%
                    poolId: 0,
                },
                {
                    poolToken: await cWETHv3.getAddress(),
                    poolLib: await compoundBufferLib.getAddress(),
                    poolPortion: 5_000n, // 50%
                    poolId: 1,
                },
            ];

            // Set up initial pools
            await depositManager.setPools([aavePool, await cWETHv3.getAddress()], newPoolsData1, [
                true,
                true,
            ]);

            // Test deposit value of 1 WETH
            const val = 1n * 10n ** 18n;

            // Verify initial balance
            expect(await WETH.balanceOf(owner)).to.be.greaterThan(val * 3n);

            // Perform deposit and verify equal distribution
            await tokenVaultWETH.requestDeposit(2n * val, owner, owner);
            expectEqual(await aWETH.balanceOf(depositManager), val);
            expectEqual(await cWETHv3.balanceOf(depositManager), val);

            // New pool configuration removing second pool
            const newPoolsData2 = [
                {
                    poolToken: await aWETH.getAddress(),
                    poolLib: await aaveBufferLib.getAddress(),
                    poolPortion: 10_000n, // 100%
                    poolId: 0,
                },
                {
                    poolToken: await cWETHv3.getAddress(),
                    poolLib: await compoundBufferLib.getAddress(),
                    poolPortion: 0n, // 0%
                    poolId: 1,
                },
            ];

            // Update pool configuration
            await depositManager.setPools([aavePool, await cWETHv3.getAddress()], newPoolsData2, [
                true,
                false,
            ]);

            // Verify final balances
            expect(await aWETH.balanceOf(depositManager)).to.be.greaterThan(val * 2n);
            expect(await cWETHv3.balanceOf(depositManager)).to.be.equal(0n);
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
            const newPoolsData = [
                {
                    poolToken: await aWETH.getAddress(),
                    poolLib: await aaveBufferLib.getAddress(),
                    poolPortion: 5_000n, // 50%
                    poolId: 0,
                },
                {
                    poolToken: await cWETHv3.getAddress(),
                    poolLib: await compoundBufferLib.getAddress(),
                    poolPortion: 5_000n, // 50%
                    poolId: 1,
                },
            ];

            // Set up pools
            await depositManager.setPools([aavePool, await cWETHv3.getAddress()], newPoolsData, [
                true,
                true,
            ]);

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

            // Initial pool configuration with uneven portions
            const poolsData = [
                {
                    poolToken: await aWETH.getAddress(),
                    poolLib: await aaveBufferLib.getAddress(),
                    poolPortion: 3_000n, // 30%
                    poolId: 0,
                },
                {
                    poolToken: await cWETHv3.getAddress(),
                    poolLib: await compoundBufferLib.getAddress(),
                    poolPortion: 7_000n, // 70%
                    poolId: 1,
                },
            ];

            // Set up initial pools
            await depositManager.setPools([aavePool, await cWETHv3.getAddress()], poolsData, [
                true,
                true,
            ]);

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
                    poolToken: await aWETH.getAddress(),
                    poolLib: await aaveBufferLib.getAddress(),
                    poolPortion: 5_000n, // 50%
                    poolId: 0,
                },
                {
                    poolToken: await cWETHv3.getAddress(),
                    poolLib: await compoundBufferLib.getAddress(),
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
        });
    });
});
