/* eslint-disable camelcase, max-lines, no-await-in-loop, no-restricted-syntax, no-bitwise, no-plusplus */
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';

import { ethers } from 'hardhat';

import { NATIVE_TOKEN } from '../../../configs';
import { findRequestRedeemEventV2 } from '../../utils/event';
import { FAUCET, grantERC20, grantETH } from '../../utils/grant';
import { expectEqual } from '../../utils/math';
import { deployMetaEth } from '../../utils/metaETH';

enum ValueMode {
    USE_MESSAGE_VALUE,
    USE_POOL_BALANCE,
    USE_BOTH_VALUES,
}

describe('Meta ETH', () => {
    it('Check deploy', async () => {
        const { metaPoolTreasury } = await loadFixture(deployMetaEth);
        const pool = await metaPoolTreasury.getTokenPool();
        expect(pool.length).to.be.equal(3);
    });

    it('Should deposit and redeem', async () => {
        const {
            user0,
            rebaseTokenV2,
            metaPoolTreasury,
            supplyManagerV2,
            stETHVault,
            stETH,
            nativeTokenVault,
            minDepositAssets,
        } = await loadFixture(deployMetaEth);

        const depositValue = minDepositAssets;

        // Grand stETH and approve tokens for stETHVault
        await grantERC20(user0, stETH, depositValue, FAUCET.stETH);
        await stETH.connect(user0).approve(stETHVault, depositValue);

        // Check shares
        const shares = await stETHVault.convertToShares(depositValue);
        const shares2 = await supplyManagerV2.convertToShares(depositValue);
        expect(shares).to.be.equal(shares2);

        // Deposit stETH
        expect(await stETHVault.previewDeposit(depositValue)).to.be.equal(shares);
        await stETHVault.connect(user0).requestDeposit(depositValue, user0, user0);
        expect(await rebaseTokenV2.sharesOf(user0)).to.be.equal(shares);
        expectEqual(await stETHVault.totalAssets(), depositValue);

        // Deposit ETH
        expect(await nativeTokenVault.previewDeposit(depositValue)).to.be.equal(shares);
        await nativeTokenVault.connect(user0).deposit(depositValue, user0, { value: depositValue });
        expect(await rebaseTokenV2.sharesOf(user0)).to.be.equal(2n * shares);
        expect(await nativeTokenVault.totalAssets()).to.be.equal(depositValue);

        // Generate yield
        await grantERC20(metaPoolTreasury, stETH, 10n * depositValue - 1n, FAUCET.stETH);

        // requestRedeem
        const userShares = await rebaseTokenV2.sharesOf(user0);
        const redeemAssets = await stETHVault.convertToAssets(userShares);
        expect(await stETHVault.maxWithdraw(user0)).to.be.equal(redeemAssets);
        const tx = await stETHVault.connect(user0).requestRedeem(userShares - 1n, user0, user0);
        expectEqual(await stETHVault.pendingRedeemRequest(0, user0), userShares);
        expect(await stETHVault.pendingRedeemRequest(0, user0)).to.be.equal(
            await stETHVault.pendingRedeemShares(user0),
        );
        const redeemEvent = await findRequestRedeemEventV2(tx);

        // fulfillRedeemRequests
        await metaPoolTreasury.fulfillRedeemRequests([redeemEvent.operationId]);
        expectEqual(await stETHVault.claimableRedeemAssets(user0), redeemAssets);

        // redeem
        expect(await stETH.balanceOf(user0)).to.be.equal(0);
        await stETHVault
            .connect(user0)
            .withdraw(await stETHVault.claimableRedeemAssets(user0), user0, user0);
        expectEqual(await stETH.balanceOf(user0), redeemAssets);
    });

    it('Should redeem immediately stETH', async () => {
        const { user0, rebaseTokenV2, metaPoolTreasury, stETHVault, stETH, minDepositAssets } =
            await loadFixture(deployMetaEth);

        const depositValue = minDepositAssets;

        // Grand stETH and approve tokens for stETHVault
        await grantERC20(user0, stETH, depositValue, FAUCET.stETH);
        await stETH.connect(user0).approve(stETHVault, depositValue);

        // Deposit stETH
        await stETHVault.connect(user0).requestDeposit(depositValue, user0, user0);

        // Generate yield
        await grantERC20(metaPoolTreasury, stETH, 10n * depositValue - 1n, FAUCET.stETH);

        // Redeem immediately
        const userShares = await rebaseTokenV2.sharesOf(user0);
        await stETHVault.connect(user0).redeemImmediately(userShares, user0, user0);
        expect(await stETH.balanceOf(user0)).to.be.greaterThan(depositValue);
    });

    it('Should redeem immediately stETH', async () => {
        const {
            user0,
            rebaseTokenV2,
            metaPoolTreasury,
            stETHVault,
            stETH,
            minDepositAssets,
            operator,
        } = await loadFixture(deployMetaEth);

        const depositValue = minDepositAssets;

        // Grand stETH and approve tokens for stETHVault
        await grantERC20(user0, stETH, depositValue, FAUCET.stETH);
        await stETH.connect(user0).approve(stETHVault, depositValue);

        // Deposit stETH
        await stETHVault.connect(user0).requestDeposit(depositValue, user0, user0);

        // Generate yield
        await grantERC20(metaPoolTreasury, stETH, 10n * depositValue - 1n, FAUCET.stETH);

        await stETHVault.connect(user0).setOperator(operator, true);

        const userShares = await rebaseTokenV2.sharesOf(user0);
        const tx = await stETHVault.connect(user0).requestRedeem(userShares, user0, user0);
        const redeemEvent = await findRequestRedeemEventV2(tx);
        await metaPoolTreasury.fulfillRedeemRequests([redeemEvent.operationId]);

        // Redeem immediately
        const partUserShares = userShares / 3n;
        await stETHVault.connect(operator).redeemImmediately(partUserShares, user0, user0);
        expect(await stETH.balanceOf(user0)).to.be.greaterThan(0);
    });

    it('Should redeem immediately stETH 2', async () => {
        const {
            user0,
            user1,
            rebaseTokenV2,
            metaPoolTreasury,
            stETHVault,
            stETH,
            minDepositAssets,
            operator,
        } = await loadFixture(deployMetaEth);

        const depositValue = minDepositAssets;

        // Grand stETH and approve tokens for stETHVault
        await grantERC20(user0, stETH, depositValue, FAUCET.stETH);
        await stETH.connect(user0).approve(stETHVault, depositValue);

        // Deposit stETH
        await stETHVault.connect(user0).requestDeposit(depositValue, user0, user0);

        // Generate yield
        await grantERC20(metaPoolTreasury, stETH, 10n * depositValue - 1n, FAUCET.stETH);

        await stETHVault.connect(user0).setOperator(operator, true);

        const userShares = await rebaseTokenV2.sharesOf(user0);
        const partUserShares = userShares / 3n;
        const tx = await stETHVault.connect(user0).requestRedeem(partUserShares, user0, user0);
        const redeemEvent = await findRequestRedeemEventV2(tx);
        await metaPoolTreasury.fulfillRedeemRequests([redeemEvent.operationId]);

        // Redeem immediately
        const sharesToRedeem =
            (await rebaseTokenV2.sharesOf(user0)) +
            (await stETHVault.convertToShares(await stETHVault.claimableRedeemAssets(user0)));
        await stETHVault.connect(operator).redeemImmediately(sharesToRedeem, user1, user0);
        expect(await stETH.balanceOf(user1)).to.be.greaterThan(depositValue);

        await expect(
            stETHVault.connect(user0).redeemImmediately(sharesToRedeem, operator, operator),
        ).to.be.rejectedWith('EInvalidOperator(');
    });

    it('Should redeem immediately ETH', async () => {
        const { user0, rebaseTokenV2, metaPoolTreasury, nativeTokenVault, minDepositAssets } =
            await loadFixture(deployMetaEth);

        const depositValue = minDepositAssets;

        // Deposit ETH
        await nativeTokenVault.connect(user0).deposit(depositValue, user0, { value: depositValue });

        // Generate yield
        await grantETH(metaPoolTreasury, 10n * depositValue - 1n);

        // Redeem immediately
        const userShares = await rebaseTokenV2.sharesOf(user0);
        await nativeTokenVault.connect(user0).redeemImmediately(userShares, user0, user0);
    });

    it('Should redeem immediately ETH', async () => {
        const {
            user0,
            rebaseTokenV2,
            metaPoolTreasury,
            nativeTokenVault,
            minDepositAssets,
            operator,
            testSeqno,
        } = await loadFixture(deployMetaEth);
        const { provider } = ethers;

        const depositValue = minDepositAssets;

        // Deposit stETH
        await nativeTokenVault.connect(user0).deposit(depositValue, user0, { value: depositValue });

        // Generate yield
        await grantETH(metaPoolTreasury, 10n * depositValue - 1n);

        await nativeTokenVault.connect(user0).setOperator(operator, true);

        const userShares = await rebaseTokenV2.sharesOf(user0);
        const tx = await nativeTokenVault.connect(user0).requestRedeem(userShares, user0, user0);
        const redeemEvent = await findRequestRedeemEventV2(tx);
        await metaPoolTreasury.fulfillRedeemRequestsForNativeToken([redeemEvent.operationId]);

        // Redeem immediately
        const partUserShares = userShares / 3n;
        await nativeTokenVault
            .connect(operator)
            .redeemImmediately(partUserShares, testSeqno, user0);
        expect(await provider.getBalance(testSeqno)).to.be.greaterThan(0);
    });

    it('Should redeem immediately ETH 2', async () => {
        const {
            user0,
            rebaseTokenV2,
            metaPoolTreasury,
            nativeTokenVault,
            minDepositAssets,
            operator,
            testSeqno,
        } = await loadFixture(deployMetaEth);
        const { provider } = ethers;

        const depositValue = minDepositAssets;

        // Deposit stETH
        await nativeTokenVault.connect(user0).deposit(depositValue, user0, { value: depositValue });

        // Generate yield
        await grantETH(metaPoolTreasury, 10n * depositValue - 1n);

        await nativeTokenVault.connect(user0).setOperator(operator, true);

        const userShares = await rebaseTokenV2.sharesOf(user0);
        const partUserShares = userShares / 3n;
        const tx = await nativeTokenVault
            .connect(user0)
            .requestRedeem(partUserShares, user0, user0);
        const redeemEvent = await findRequestRedeemEventV2(tx);
        await metaPoolTreasury.fulfillRedeemRequestsForNativeToken([redeemEvent.operationId]);

        // Redeem immediately
        const sharesToRedeem =
            (await rebaseTokenV2.sharesOf(user0)) +
            (await nativeTokenVault.convertToShares(
                await nativeTokenVault.claimableRedeemAssets(user0),
            ));
        await nativeTokenVault
            .connect(operator)
            .redeemImmediately(sharesToRedeem, testSeqno, user0);
        expect(await provider.getBalance(testSeqno)).to.be.greaterThan(depositValue);

        await expect(
            nativeTokenVault.connect(user0).redeemImmediately(sharesToRedeem, operator, operator),
        ).to.be.rejectedWith('EInvalidOperator(');
    });

    it('Test execute', async () => {
        const { user0, metaPoolTreasury, stETH, poolKeeper, approveSelector } =
            await loadFixture(deployMetaEth);
        const encodedBalanceOf = stETH.interface.encodeFunctionData('balanceOf', [user0.address]);
        const execEncodedBalanceOf = [
            {
                target: stETH,
                data: encodedBalanceOf,
                value: 0,
            },
        ];
        await expect(
            metaPoolTreasury
                .connect(poolKeeper)
                .execute(execEncodedBalanceOf, ValueMode.USE_MESSAGE_VALUE),
        ).to.be.rejectedWith('ENotPresentInWhiteList(');
        await metaPoolTreasury.addInWhiteList(stETH, approveSelector);
        await metaPoolTreasury.addInWhiteList(
            stETH,
            stETH.interface.getFunction('balanceOf').selector,
        );

        await expect(metaPoolTreasury.connect(user0).pauseExecute()).to.be.rejectedWith(
            'ENotAuthorizedForPause()',
        );
        await metaPoolTreasury.pauseExecute();
        expect(await metaPoolTreasury.isExecutePaused()).to.be.equal(true);
        await expect(
            metaPoolTreasury
                .connect(poolKeeper)
                .execute(execEncodedBalanceOf, ValueMode.USE_MESSAGE_VALUE),
        ).to.be.rejectedWith('EFunctionPaused(');
        await expect(metaPoolTreasury.connect(user0).unpauseExecute()).to.be.rejectedWith(
            'OwnableUnauthorizedAccount(',
        );
        await metaPoolTreasury.unpauseExecute();

        await metaPoolTreasury
            .connect(poolKeeper)
            .execute(execEncodedBalanceOf, ValueMode.USE_MESSAGE_VALUE);
    });

    it('Test send eth', async () => {
        const { metaPoolTreasury, poolKeeper, testSeqno } = await loadFixture(deployMetaEth);

        const execEncodedBalanceOf = [
            {
                target: testSeqno,
                data: '0x',
                value: 1,
            },
        ];
        await metaPoolTreasury.addInWhiteList(testSeqno, '0x00000000');

        const prevCounter = await testSeqno.seqno();
        await metaPoolTreasury
            .connect(poolKeeper)
            .execute(execEncodedBalanceOf, ValueMode.USE_MESSAGE_VALUE, { value: 1 });
        // Check that testSeqno.receive function was called
        expect(await testSeqno.seqno()).to.be.equal(prevCounter + 10n);

        await grantETH(metaPoolTreasury, 1);
        await expect(
            metaPoolTreasury
                .connect(poolKeeper)
                .execute(execEncodedBalanceOf, ValueMode.USE_BOTH_VALUES, { value: 0 }),
        ).be.be.rejectedWith('EWrongMsgValue(');
    });

    it('Test approve execute', async () => {
        const { user0, metaPoolTreasury, stETH, poolKeeper } = await loadFixture(deployMetaEth);

        await metaPoolTreasury.setSpenderInWhiteList(user0, true);
        await metaPoolTreasury.addInWhiteList(
            stETH,
            stETH.interface.getFunction('approve').selector,
        );

        const encodedApprove = stETH.interface.encodeFunctionData('approve', [
            user0.address,
            100500,
        ]);
        const execArgs = [
            {
                target: stETH,
                data: encodedApprove,
                value: 1,
            },
        ];
        await expect(
            metaPoolTreasury.execute(execArgs, ValueMode.USE_MESSAGE_VALUE),
        ).to.be.rejectedWith('ENotAuthorized()');
        await expect(
            metaPoolTreasury.connect(poolKeeper).execute(execArgs, ValueMode.USE_MESSAGE_VALUE),
        ).to.be.rejectedWith('EMsgValueIsNotZero()');

        const execArgs0 = [
            {
                target: stETH,
                data: encodedApprove,
                value: 0,
            },
        ];
        await metaPoolTreasury.setSpenderInWhiteList(user0, false);
        await expect(
            metaPoolTreasury.connect(poolKeeper).execute(execArgs0, ValueMode.USE_MESSAGE_VALUE),
        ).to.be.rejectedWith('ENotInWhiteListSpender()');
        await metaPoolTreasury.setSpenderInWhiteList(user0, true);

        await metaPoolTreasury.setBlockToken(stETH, true);
        await expect(
            metaPoolTreasury.connect(poolKeeper).execute(execArgs0, ValueMode.USE_MESSAGE_VALUE),
        ).to.be.rejectedWith('ETokenBlocked()');
        await metaPoolTreasury.setBlockToken(stETH, false);

        await metaPoolTreasury.connect(poolKeeper).execute(execArgs0, ValueMode.USE_MESSAGE_VALUE);
    });

    it('Test approve execute with value', async () => {
        const { metaPoolTreasury, testSeqno, poolKeeper } = await loadFixture(deployMetaEth);

        await metaPoolTreasury.addInWhiteList(
            testSeqno,
            testSeqno.interface.getFunction('incAndPay').selector,
        );

        const encodedData = testSeqno.interface.encodeFunctionData('incAndPay', [12n]);
        const execArgs0 = [
            {
                target: testSeqno,
                data: encodedData,
                value: 1,
            },
        ];
        await expect(
            metaPoolTreasury
                .connect(poolKeeper)
                .execute(execArgs0, ValueMode.USE_MESSAGE_VALUE, { value: 2 }),
        ).to.be.rejectedWith('EWrongMsgValue()');
        await metaPoolTreasury
            .connect(poolKeeper)
            .execute(execArgs0, ValueMode.USE_MESSAGE_VALUE, { value: 1 });
    });

    it('Test sending pool balance', async () => {
        const { metaPoolTreasury, testSeqno, poolKeeper } = await loadFixture(deployMetaEth);
        const { provider } = ethers;

        expect(await provider.getBalance(metaPoolTreasury)).to.be.equal(0);
        await grantETH(metaPoolTreasury, 100500);

        await metaPoolTreasury.addInWhiteList(
            testSeqno,
            testSeqno.interface.getFunction('incAndPay').selector,
        );

        const encodedData = testSeqno.interface.encodeFunctionData('incAndPay', [12n]);
        const execArgs0 = [
            {
                target: testSeqno,
                data: encodedData,
                value: 100500,
            },
        ];
        await expect(
            metaPoolTreasury
                .connect(poolKeeper)
                .execute(execArgs0, ValueMode.USE_POOL_BALANCE, { value: 1 }),
        ).to.rejectedWith('EMsgValueIsNotZero');
        await metaPoolTreasury
            .connect(poolKeeper)
            .execute(execArgs0, ValueMode.USE_POOL_BALANCE, { value: 0 });
    });

    it('Test sending value and pool balance', async () => {
        const { metaPoolTreasury, testSeqno, poolKeeper } = await loadFixture(deployMetaEth);
        const { provider } = ethers;

        await metaPoolTreasury.addInWhiteList(
            testSeqno,
            testSeqno.interface.getFunction('incAndPay').selector,
        );

        expect(await provider.getBalance(metaPoolTreasury)).to.be.equal(0);
        await grantETH(metaPoolTreasury, 100500);

        const encodedData = testSeqno.interface.encodeFunctionData('incAndPay', [12n]);
        const execArgs0 = [
            {
                target: testSeqno,
                data: encodedData,
                value: 100500 + 1,
            },
        ];
        await metaPoolTreasury
            .connect(poolKeeper)
            .execute(execArgs0, ValueMode.USE_BOTH_VALUES, { value: 1 });
    });

    it('Test add/remove tokens', async () => {
        const { minDepositAssets, metaPoolTreasury, stETH, poolOwner } =
            await loadFixture(deployMetaEth);
        const grantAssets = 10n * minDepositAssets;
        const { provider } = ethers;

        await metaPoolTreasury.removeToken(stETH);
        await metaPoolTreasury.addToken(stETH);

        await grantERC20(metaPoolTreasury, stETH, grantAssets, FAUCET.stETH);
        await metaPoolTreasury.removeToken(stETH);
        expectEqual(await stETH.balanceOf(metaPoolTreasury), 0n);
        expectEqual(await stETH.balanceOf(poolOwner), grantAssets);
        await metaPoolTreasury.addToken(stETH);

        await metaPoolTreasury.removeToken(NATIVE_TOKEN);
        await metaPoolTreasury.addToken(NATIVE_TOKEN);
        await grantETH(metaPoolTreasury, grantAssets);
        expect(await provider.getBalance(metaPoolTreasury)).to.be.greaterThan(0);
        await metaPoolTreasury.removeToken(NATIVE_TOKEN);
        expect(await provider.getBalance(metaPoolTreasury)).to.be.equal(0);
        await metaPoolTreasury.addToken(NATIVE_TOKEN);
    });

    it('Test white list', async () => {
        const { testSeqno, metaPoolTreasury, approveSelector } = await loadFixture(deployMetaEth);
        await metaPoolTreasury.deleteFromWhiteList(testSeqno, approveSelector);
        await expect(
            metaPoolTreasury.deleteFromWhiteList(testSeqno, approveSelector),
        ).to.be.rejectedWith('ENotPresentInWhiteList(');
    });

    it('Owner does not receive eth', async () => {
        const { metaPoolTreasury, poolOwner, minDepositAssets } = await loadFixture(deployMetaEth);
        const grantAssets = 10n * minDepositAssets;

        const MockOwner = await ethers.getContractFactory('MockOwner');
        const mockOwner = await MockOwner.connect(poolOwner).deploy();

        await metaPoolTreasury.transferOwnership(mockOwner);
        await mockOwner.acceptOwnership(metaPoolTreasury);

        await grantETH(metaPoolTreasury, grantAssets);
        await mockOwner.execute(
            metaPoolTreasury,
            metaPoolTreasury.interface.encodeFunctionData('removeToken', [NATIVE_TOKEN]),
            0,
        );
    });

    it('Check setPoolKeeper', async () => {
        const { metaPoolTreasury, randAccount } = await loadFixture(deployMetaEth);
        await expect(metaPoolTreasury.setPoolKeeper(ethers.ZeroAddress)).to.be.rejectedWith(
            'EZeroAddress()',
        );
        await metaPoolTreasury.setPoolKeeper(randAccount);
        expect(await metaPoolTreasury.poolKeeper()).to.be.equal(randAccount);
    });

    it('Block token', async () => {
        const { metaPoolTreasury, stETH } = await loadFixture(deployMetaEth);

        await expect(metaPoolTreasury.setBlockToken(metaPoolTreasury, true)).to.be.rejectedWith(
            'ETokenNotExist()',
        );
        await metaPoolTreasury.setBlockToken(stETH, true);
        await expect(metaPoolTreasury.setBlockToken(stETH, true)).to.be.rejectedWith(
            'EAlreadyBlockedSet()',
        );
    });

    it('Test errors', async () => {
        const { metaPoolTreasury, user0, approveSelector } = await loadFixture(deployMetaEth);
        await expect(metaPoolTreasury.fulfillRedeemRequests([])).to.be.rejectedWith(
            'EEmptyArray()',
        );
        await expect(metaPoolTreasury.fulfillRedeemRequestsForNativeToken([])).to.be.rejectedWith(
            'EEmptyArray()',
        );

        await metaPoolTreasury.pauseFulfillRedeemRequests();
        expect(await metaPoolTreasury.isFulFillRedeemPaused()).to.be.equal(true);
        await expect(metaPoolTreasury.fulfillRedeemRequests([1])).to.be.rejectedWith(
            'EFunctionPaused(',
        );
        await expect(metaPoolTreasury.fulfillRedeemRequestsForNativeToken([1])).to.be.rejectedWith(
            'EFunctionPaused(',
        );
        await metaPoolTreasury.unpauseFulfillRedeemRequests();
        expect(await metaPoolTreasury.isFulFillRedeemPaused()).to.be.equal(false);

        await expect(
            metaPoolTreasury.connect(user0).deposit(0, ethers.ZeroAddress, ethers.ZeroAddress, 0),
        ).to.be.rejectedWith('ENotAuthorized(');
        await expect(
            metaPoolTreasury
                .connect(user0)
                .depositNativeToken(0, ethers.ZeroAddress, ethers.ZeroAddress, 0),
        ).to.be.rejectedWith('ENotAuthorized(');
        await expect(
            metaPoolTreasury
                .connect(user0)
                .requestRedeem(0, ethers.ZeroAddress, ethers.ZeroAddress, 0),
        ).to.be.rejectedWith('ENotAuthorized(');
        await expect(
            metaPoolTreasury.connect(user0).grantNativeToken(ethers.ZeroAddress, 0),
        ).to.be.rejectedWith('ENotAuthorized(');
        await expect(
            metaPoolTreasury.connect(user0).addTokenVault(ethers.ZeroAddress),
        ).to.be.rejectedWith('ENotAuthorized(');
        await expect(
            metaPoolTreasury.connect(user0).removeTokenVault(ethers.ZeroAddress),
        ).to.be.rejectedWith('ENotAuthorized(');
        await expect(
            metaPoolTreasury.connect(user0).addToken(ethers.ZeroAddress),
        ).to.be.rejectedWith('OwnableUnauthorizedAccount(');
        await expect(
            metaPoolTreasury.connect(user0).removeToken(ethers.ZeroAddress),
        ).to.be.rejectedWith('OwnableUnauthorizedAccount(');
        await expect(
            metaPoolTreasury.connect(user0).setPoolKeeper(ethers.ZeroAddress),
        ).to.be.rejectedWith('OwnableUnauthorizedAccount(');
        await expect(
            metaPoolTreasury.connect(user0).setBlockToken(ethers.ZeroAddress, true),
        ).to.be.rejectedWith('OwnableUnauthorizedAccount(');
        await expect(
            metaPoolTreasury.connect(user0).addInWhiteList(ethers.ZeroAddress, approveSelector),
        ).to.be.rejectedWith('OwnableUnauthorizedAccount(');
        await expect(
            metaPoolTreasury
                .connect(user0)
                .deleteFromWhiteList(ethers.ZeroAddress, approveSelector),
        ).to.be.rejectedWith('OwnableUnauthorizedAccount(');
        await expect(
            metaPoolTreasury.connect(user0).pauseFulfillRedeemRequests(),
        ).to.be.rejectedWith('ENotAuthorizedForPause(');
        await expect(
            metaPoolTreasury.connect(user0).unpauseFulfillRedeemRequests(),
        ).to.be.rejectedWith('OwnableUnauthorizedAccount(');

        await expect(
            metaPoolTreasury.addInWhiteList(ethers.ZeroAddress, approveSelector),
        ).to.be.rejectedWith('EZeroAddress()');
        await metaPoolTreasury.addInWhiteList(user0, approveSelector);
        await expect(metaPoolTreasury.addInWhiteList(user0, approveSelector)).to.be.rejectedWith(
            'EAlreadyAddedInWhiteList()',
        );

        await expect(metaPoolTreasury.removeToken(ethers.ZeroAddress)).to.be.rejectedWith(
            'ETokenNotExist()',
        );
        await expect(metaPoolTreasury.addToken(NATIVE_TOKEN)).to.be.rejectedWith(
            'EDuplicatedToken()',
        );
    });

    it('Test deposit errors', async () => {
        const {
            user0,
            metaPoolTreasury,
            stETHVault,
            stETH,
            nativeTokenVault,
            minDepositAssets,
            rebaseTokenV2,
        } = await loadFixture(deployMetaEth);

        const depositValue = minDepositAssets;

        // Grand stETH and approve tokens for stETHVault
        await grantERC20(user0, stETH, 2n * depositValue, FAUCET.stETH);
        await stETH.connect(user0).approve(stETHVault, 2n * depositValue);

        // Deposit stETH
        await stETHVault.connect(user0).requestDeposit(depositValue, user0, user0);

        // Remove token
        await metaPoolTreasury.removeToken(stETH);
        await metaPoolTreasury.removeToken(NATIVE_TOKEN);

        // Fail to deposit/redeem tokens
        await expect(
            stETHVault.connect(user0).requestDeposit(depositValue, user0, user0),
        ).to.be.rejectedWith('ETokenNotExist()');
        await expect(
            nativeTokenVault.connect(user0).deposit(depositValue, user0, { value: depositValue }),
        ).to.be.rejectedWith('ETokenNotExist()');
        await expect(
            nativeTokenVault.connect(user0).requestRedeem(depositValue, user0, user0),
        ).to.be.rejectedWith('ETokenNotExist()');

        // Remove token vaults
        await rebaseTokenV2.removeTokenVault(stETHVault);
        await rebaseTokenV2.removeTokenVault(nativeTokenVault);
    });

    it('Test deposit errors 2', async () => {
        const { user0, metaPoolTreasury, stETHVault, stETH, minDepositAssets } =
            await loadFixture(deployMetaEth);

        const depositValue = minDepositAssets;

        // Grand stETH and approve tokens for stETHVault
        await grantERC20(user0, stETH, 2n * depositValue, FAUCET.stETH);
        await stETH.connect(user0).approve(stETHVault, 2n * depositValue);

        await stETHVault.connect(user0).requestDeposit(depositValue, user0, user0);
        const tx = await stETHVault.connect(user0).requestRedeem(depositValue, user0, user0);
        const redeemEvent = await findRequestRedeemEventV2(tx);
        await metaPoolTreasury.setBlockToken(stETH, true);
        await expect(
            metaPoolTreasury.fulfillRedeemRequests([redeemEvent.operationId]),
        ).to.be.rejectedWith('ETokenBlocked()');
        await expect(metaPoolTreasury.removeToken(stETH)).to.be.rejectedWith(
            'ENotZeroValueToRedeemOfRemovedToken()',
        );
    });

    it('Check adding token', async () => {
        const { rebaseTokenV2, stETHVault, stETH, metaPoolTreasury } =
            await loadFixture(deployMetaEth);

        await rebaseTokenV2.removeTokenVault(stETHVault);
        await expect(metaPoolTreasury.addToken(stETH)).to.be.rejectedWith(
            'EnumerableMapNonexistentKey(',
        );
    });

    it('Check ERC-1271', async () => {
        const { metaPoolTreasury, poolKeeper, user0 } = await loadFixture(deployMetaEth);

        expect(await metaPoolTreasury.signatureAuthority()).to.be.equal(poolKeeper);

        const message = 'Hello, OpenZeppelin!';
        const messageHash = ethers.hashMessage(message);
        const signature = await poolKeeper.signMessage(message);

        let result = await metaPoolTreasury.isValidSignature(messageHash, signature);
        expect(result).to.be.equal('0x1626ba7e');

        result = await metaPoolTreasury.isValidSignature(ethers.hashMessage('Hello!'), signature);
        expect(result).to.be.equal('0xffffffff');

        await metaPoolTreasury.setSigner(user0);
        result = await metaPoolTreasury.isValidSignature(
            messageHash,
            await user0.signMessage(message),
        );
        expect(result).to.be.equal('0x1626ba7e');

        await expect(metaPoolTreasury.connect(user0).setSigner(user0)).to.be.rejectedWith(
            'OwnableUnauthorizedAccount(',
        );
        await expect(metaPoolTreasury.setSigner(ethers.ZeroAddress)).to.be.rejectedWith(
            'EZeroAddress(',
        );
    });

    it('Check wmetaETH', async () => {
        const { wmetaETH, rebaseTokenV2, user0, stETH, metaPoolTreasury, stETHVault } =
            await loadFixture(deployMetaEth);

        // Deposit stETH
        const decimals: bigint = await stETH.decimals();
        const depositValue = 2n * 10n ** decimals;
        await grantERC20(user0, stETH, 2n * depositValue, FAUCET.stETH);
        await stETH.connect(user0).approve(stETHVault, depositValue);
        await stETHVault.connect(user0).requestDeposit(depositValue, user0, user0);

        // Generate yield
        const income = 5n * 10n ** 18n;
        await grantERC20(metaPoolTreasury, stETH, income, FAUCET.stETH);

        // Convert metaETH to wmetaETH
        const shares = await rebaseTokenV2.sharesOf(user0);
        const rebaseAssets = await rebaseTokenV2.balanceOf(user0);
        await rebaseTokenV2.connect(user0).approve(wmetaETH, rebaseAssets);
        await wmetaETH.connect(user0).wrap(rebaseAssets);
        expectEqual(await wmetaETH.balanceOf(user0), shares);
        expectEqual(await rebaseTokenV2.balanceOf(user0), 0n);

        // Convert wmetaETH to metaETH
        await wmetaETH.connect(user0).unwrap(await wmetaETH.balanceOf(user0));
        expect(await wmetaETH.balanceOf(user0)).to.be.equal(0);
        expectEqual(await rebaseTokenV2.balanceOf(user0), rebaseAssets);
    });
});
