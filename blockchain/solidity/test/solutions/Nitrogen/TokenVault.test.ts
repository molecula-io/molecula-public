/* eslint-disable camelcase, max-lines, no-await-in-loop, no-restricted-syntax, no-bitwise, no-plusplus */
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import { keccak256 } from 'ethers';
import { ethers } from 'hardhat';

import { deployNitrogenWithTokenVault, getRidOf } from '../../utils/NitrogenCommon';
import { findRequestRedeemEvent } from '../../utils/event';
import { FAUCET, grantERC20 } from '../../utils/grant';
import { expectEqual } from '../../utils/math';

describe('Test TokenVault', () => {
    it('Should deposit and redeem via usdcVault', async () => {
        const { usdcVault, USDC, user0, user1, user2, operator, rebaseToken } = await loadFixture(
            deployNitrogenWithTokenVault,
        );

        const decimals: bigint = await USDC.decimals();
        const depositValue = 100n * 10n ** decimals;

        // Grand USD and approve tokens for usdcVault
        await grantERC20(user0, USDC, 2n * depositValue);
        await USDC.connect(user0).approve(usdcVault, 2n * depositValue);

        // user0 sets operator and deposit tokens two times
        await usdcVault.connect(user0).setOperator(operator, true);
        await usdcVault
            .connect(operator)
            ['deposit(uint256,address,address)'](depositValue, user1, user0);
        await usdcVault
            .connect(user0)
            ['deposit(uint256,address,address)'](depositValue, user1, user0);

        const shares = 100n * 10n ** 18n;
        expect(await rebaseToken.balanceOf(user1)).to.be.equal(2n * shares);

        // user1 request redeem
        expect(await USDC.balanceOf(user1)).to.be.equal(0);

        await usdcVault.connect(user1).redeemImmediately(shares, user1, user1);
        expect(await rebaseToken.balanceOf(user1)).to.be.equal(shares);
        expect(await USDC.balanceOf(user1)).to.be.equal(depositValue);
        expect(await USDC.balanceOf(user2)).to.be.equal(0);

        // operator requests redeem on behalf of user1 and gives tokens to user2
        await usdcVault.connect(user1).setOperator(operator, true);
        await usdcVault.connect(operator).redeemImmediately(shares, user2, user1);
        expect(await rebaseToken.balanceOf(user1)).to.be.equal(0);
        expect(await USDC.balanceOf(user1)).to.be.equal(depositValue);
        expect(await USDC.balanceOf(user2)).to.be.equal(depositValue);

        await expect(
            usdcVault.connect(user0).redeemImmediately(1, user1, user1),
        ).to.be.rejectedWith('EInvalidOperator');
    });

    it('Should deposit and redeem in one transaction via usdcVault', async () => {
        const {
            usdcVault,
            USDC,
            user0,
            rebaseToken,
            supplyManager,
            moleculaPool,
            poolKeeper,
            randAccount,
            poolOwner,
        } = await loadFixture(deployNitrogenWithTokenVault);

        const decimals: bigint = await USDC.decimals();
        const depositValue = 100n * 10n ** decimals;

        // Grand USD and approve tokens for usdcVault
        await grantERC20(user0, USDC, depositValue);
        await USDC.connect(user0).approve(usdcVault, depositValue);

        // user0 deposits tokens
        await usdcVault
            .connect(user0)
            ['deposit(uint256,address,address)'](depositValue, user0, user0);
        const shares = 100n * 10n ** 18n;
        expect(await rebaseToken.balanceOf(user0)).to.be.equal(shares);

        // user0 request redeem
        let tx = await usdcVault.connect(user0).redeemImmediately(shares / 2n, user0, user0);
        await tx.wait();
        let { operationId } = await findRequestRedeemEvent(tx);
        await expect(tx)
            .to.emit(supplyManager, 'Redeem')
            .withArgs([operationId], [depositValue / 2n]);

        // check balance
        expect(await rebaseToken.balanceOf(user0)).to.be.equal(shares / 2n);
        expect(await USDC.balanceOf(user0)).to.be.equal(depositValue / 2n);

        // get rid of USDC from moleculaPool
        await getRidOf(moleculaPool, poolOwner, USDC, randAccount.address, poolKeeper);

        // user0 request redeem
        tx = await usdcVault.connect(user0).requestRedeem(shares / 2n, user0, user0);
        await tx.wait();
        const eventData = await findRequestRedeemEvent(tx);
        operationId = eventData.operationId;
        expect(await rebaseToken.balanceOf(user0)).to.be.equal(0);
        expect(await USDC.balanceOf(user0)).to.be.equal(depositValue / 2n);

        // Return USDC tokens to moleculaPool
        await USDC.connect(randAccount).transfer(moleculaPool, await USDC.balanceOf(randAccount));

        // user0 redeems their tokens.
        await moleculaPool.connect(user0).redeem([operationId]);
        expectEqual(await rebaseToken.balanceOf(user0), 0n);
        expect(await USDC.balanceOf(user0)).to.be.equal(50_000_000);

        // user0 confirms redeem.
        const claimableRedeemAssets = await usdcVault.claimableRedeemAssets(user0);
        await usdcVault.connect(user0).withdraw(claimableRedeemAssets, user0, user0);
        // expect(await USDC.balanceOf(user0)).to.be.equal(50_000_000 + 33_333_333);
    });

    it('Test set min deposit / redeem value', async () => {
        const { usdcVault, USDC, user0, rebaseToken } = await loadFixture(
            deployNitrogenWithTokenVault,
        );

        const decimals: bigint = await USDC.decimals();
        const depositValue = 5n * 10n ** (decimals - 1n);

        // Grand USD and approve tokens for usdcVault
        await grantERC20(user0, USDC, depositValue);
        await USDC.connect(user0).approve(usdcVault, depositValue);

        // Fail to deposit, set new min deposit value and deposit
        await expect(
            usdcVault
                .connect(user0)
                ['deposit(uint256,address,address)'](depositValue, user0, user0),
        ).to.be.rejectedWith('ETooLowDepositAssets(');
        await usdcVault.setMinDepositAssets(depositValue);
        await usdcVault
            .connect(user0)
            ['deposit(uint256,address,address)'](depositValue, user0, user0);
        expect(await rebaseToken.balanceOf(user0)).to.be.greaterThan(0n);

        await usdcVault.setMinRedeemShares(12345);
        expect(await usdcVault.minRedeemShares()).to.be.equal(12345);
    });

    it('Should pause/unpause', async () => {
        const { usdcVault, USDC, user0, rebaseToken, poolOwner, guardian } = await loadFixture(
            deployNitrogenWithTokenVault,
        );

        const decimals: bigint = await USDC.decimals();
        const depositValue = 100n * 10n ** decimals;

        // Grand USD and approve tokens for usdcVault
        const depositQty = 2n;
        await grantERC20(user0, USDC, depositQty * depositValue);
        await USDC.connect(user0).approve(usdcVault, depositQty * depositValue);

        // pause and unpause request deposit and then call requestDeposit
        await usdcVault.connect(guardian).pauseRequestDeposit();
        await expect(
            usdcVault
                .connect(user0)
                ['deposit(uint256,address,address)'](depositValue, user0, user0),
        ).to.be.rejectedWith('EFunctionPaused(');
        await usdcVault.connect(poolOwner).unpauseRequestDeposit();
        await usdcVault
            .connect(user0)
            ['deposit(uint256,address,address)'](depositValue, user0, user0);

        // pauseAll and unpauseAll and then call requestDeposit
        await usdcVault.connect(guardian).pauseAll();
        await expect(
            usdcVault
                .connect(user0)
                ['deposit(uint256,address,address)'](depositValue, user0, user0),
        ).to.be.rejectedWith('EFunctionPaused("');
        await usdcVault.connect(poolOwner).unpauseAll();
        await usdcVault
            .connect(user0)
            ['deposit(uint256,address,address)'](depositValue, user0, user0);

        const shares = 100n * 10n ** 18n;

        // pause and unpause requestRedeem and then call redeemImmediately
        await usdcVault.connect(guardian).pauseRequestRedeem();
        await expect(
            usdcVault.connect(user0).redeemImmediately(shares, user0, user0),
        ).to.be.rejectedWith('EFunctionPaused("');
        await usdcVault.connect(poolOwner).unpauseRequestRedeem();
        await usdcVault.connect(user0).redeemImmediately(shares, user0, user0);

        // pauseAll and unpauseAll and then call redeemImmediately
        await usdcVault.connect(guardian).pauseAll();
        await expect(
            usdcVault.connect(user0).redeemImmediately(shares, user0, user0),
        ).to.be.rejectedWith('EFunctionPaused("');
        await usdcVault.connect(poolOwner).unpauseAll();
        await usdcVault.connect(user0).redeemImmediately(shares, user0, user0);

        // check user0's balances
        expect(await rebaseToken.balanceOf(user0)).to.be.equal(0);
        expect(await USDC.balanceOf(user0)).to.be.equal(depositQty * depositValue);
    });

    it('Should set parameters', async () => {
        const { rebaseTokenOwner, user0, user1, rebaseToken, poolOwner } = await loadFixture(
            deployNitrogenWithTokenVault,
        );

        await rebaseTokenOwner.callRebaseToken(
            rebaseToken.interface.encodeFunctionData('setAccountant', [user0.address]),
        );
        expect(await rebaseToken.accountant()).to.be.equal(user0);

        await rebaseTokenOwner.callRebaseToken(
            rebaseToken.interface.encodeFunctionData('setOracle', [user1.address]),
        );
        expect(await rebaseToken.oracle()).to.be.equal(user1);

        await rebaseTokenOwner.callRebaseToken(
            rebaseToken.interface.encodeFunctionData('setMinDepositValue', [123]),
        );
        expect(await rebaseToken.minDepositValue()).to.be.equal(123);

        await rebaseTokenOwner.callRebaseToken(
            rebaseToken.interface.encodeFunctionData('setMinRedeemValue', [1234]),
        );
        expect(await rebaseToken.minRedeemValue()).to.be.equal(1234);

        await expect(
            rebaseTokenOwner
                .connect(poolOwner)
                .callRebaseToken(
                    rebaseToken.interface.encodeFunctionData('transferOwnership', [user0.address]),
                ),
        ).to.be.rejectedWith('EBadSelector()');

        await rebaseTokenOwner.changeGuardian(user0);
        expect(await rebaseTokenOwner.guardian()).to.be.equal(user0);
    });

    it('Should remove token', async () => {
        const { usdcVault, rebaseTokenOwner, USDC, user0 } = await loadFixture(
            deployNitrogenWithTokenVault,
        );

        const decimals: bigint = await USDC.decimals();
        const depositValue = 100n * 10n ** decimals;

        // Grand USD and approve tokens for usdcVault
        await grantERC20(user0, USDC, depositValue);
        await USDC.connect(user0).approve(usdcVault, depositValue);

        // Remove token
        await rebaseTokenOwner.removeTokenVault(usdcVault);
        await expect(rebaseTokenOwner.removeTokenVault(usdcVault)).to.be.rejectedWith(
            'ENoTokenVault(',
        );
        await expect(
            usdcVault.connect(user0)['deposit(uint256,address,address)'](10n ** 6n, user0, user0),
        ).to.be.rejectedWith('TokenVaultNotAllowed(');
    });

    it('Distribute yield via usdcVault usdcVault', async () => {
        const { usdcVault, rebaseToken, USDC, user1, supplyManager, moleculaPool } =
            await loadFixture(deployNitrogenWithTokenVault);

        // generate income
        const decimals: bigint = await USDC.decimals();
        const income = 100500n * 10n ** decimals;
        await grantERC20(moleculaPool, USDC, income);

        // distribute yield
        const party = {
            parties: [
                {
                    party: user1,
                    portion: 10n ** 18n,
                },
            ],
            agent: usdcVault,
            ethValue: 0n,
        };
        expect(await rebaseToken.balanceOf(user1)).to.equal(0);
        await supplyManager.distributeYield([party], 5000);
        expect(await rebaseToken.balanceOf(user1)).to.greaterThan(0);
    });

    it('White list for agents in the usdcVault', async () => {
        const { rebaseToken, rebaseTokenOwner, guardian, randAccount, supplyManager, DAI } =
            await loadFixture(deployNitrogenWithTokenVault);

        // Create new dai usdcVault and add it in usdcVault
        const TokenVault = await ethers.getContractFactory('NitrogenTokenVault');
        const daiTokenVault = await TokenVault.connect(randAccount).deploy(
            randAccount,
            rebaseToken, // share
            supplyManager,
            rebaseTokenOwner,
            guardian,
            ethers.ZeroAddress,
        );
        await daiTokenVault.connect(randAccount).init(DAI, 10n ** 6n, 10n ** 18n);

        // Remove dia usdcVault
        await rebaseTokenOwner.removeTokenVault(daiTokenVault);

        // Remove code hash from whitelist
        const codeHash = keccak256((await daiTokenVault.getDeployedCode())!);
        await rebaseTokenOwner.setCodeHash(codeHash, false);
        await expect(rebaseTokenOwner.setCodeHash(codeHash, false)).to.be.rejectedWith(
            'EAlreadySetStatus()',
        );

        // Fail to add TokenVault into RebaseTokenOwner
        await expect(rebaseTokenOwner.addTokenVault(daiTokenVault)).to.be.rejectedWith(
            'CodeHashNotInWhiteList()',
        );
    });

    it('Test usdcVault.{deposit,redeem} errors', async () => {
        const { user0, user1, usdcVault, USDC } = await loadFixture(deployNitrogenWithTokenVault);

        const decimals: bigint = await USDC.decimals();
        const depositValue = 100n * 10n ** decimals;

        // Grand USD and approve tokens for usdcVault
        await grantERC20(user0, USDC, depositValue);
        await USDC.connect(user0).approve(usdcVault, depositValue);

        await expect(
            usdcVault
                .connect(user1)
                ['deposit(uint256,address,address)'](depositValue, user1, user0),
        ).to.be.rejectedWith('EInvalidOperator(');
        await expect(
            usdcVault.connect(user1)['mint(uint256,address,address)'](depositValue, user1, user0),
        ).to.be.rejectedWith('EInvalidOperator(');
        await usdcVault
            .connect(user0)
            ['deposit(uint256,address,address)'](depositValue, user0, user0);

        const shares = 100n * 10n ** 18n;

        await expect(
            usdcVault.connect(user1).requestRedeem(shares, user1, user0),
        ).to.be.rejectedWith('EInvalidOperator(');
        await expect(usdcVault.connect(user0).requestRedeem(1, user0, user0)).to.be.rejectedWith(
            'ETooLowRequestRedeemShares(',
        );

        const restShares = await usdcVault.maxRedeem(user0);
        const tx = await usdcVault.connect(user0).requestRedeem(restShares, user0, user0);
        const operationId0 = (await findRequestRedeemEvent(tx)).operationId;

        await expect(
            usdcVault['redeem(address,uint256[],uint256[],uint256)'](user0, [operationId0], [1], 1),
        ).to.be.rejectedWith('ENotAuthorized(');
    });

    it('Test rebaseTokenOwner pause', async () => {
        const { usdcVault, USDC, user0, rebaseTokenOwner, rebaseToken } = await loadFixture(
            deployNitrogenWithTokenVault,
        );

        const decimals: bigint = await USDC.decimals();
        const depositValue = 100n * 10n ** decimals;

        // Grand USD and approve tokens for usdcVault
        await grantERC20(user0, USDC, 2n * depositValue);
        await USDC.connect(user0).approve(usdcVault, 2n * depositValue);

        // user0 deposits tokens
        await rebaseTokenOwner.pauseMint();
        await expect(
            usdcVault.connect(user0).requestDeposit(depositValue, user0, user0),
        ).to.be.rejectedWith('EFunctionPaused("');
        await rebaseTokenOwner.unpauseMint();
        await usdcVault.connect(user0).requestDeposit(depositValue, user0, user0);

        await rebaseTokenOwner.pauseAll();
        await expect(
            usdcVault.connect(user0).requestDeposit(depositValue, user0, user0),
        ).to.be.rejectedWith('EFunctionPaused("');
        await rebaseTokenOwner.unpauseAll();
        await usdcVault.connect(user0).requestDeposit(depositValue, user0, user0);

        const shares = (await rebaseToken.balanceOf(user0)) / 2n;
        // user0 redeem tokens
        await rebaseTokenOwner.pauseBurn();
        await expect(
            usdcVault.connect(user0).redeemImmediately(shares, user0, user0),
        ).to.be.rejectedWith('EFunctionPaused(');
        await rebaseTokenOwner.unpauseBurn();
        await usdcVault.connect(user0).redeemImmediately(shares, user0, user0);

        await rebaseTokenOwner.pauseAll();
        await expect(
            usdcVault.connect(user0).redeemImmediately(shares, user0, user0),
        ).to.be.rejectedWith('EFunctionPaused(');
        await rebaseTokenOwner.unpauseAll();
        await usdcVault.connect(user0).redeemImmediately(shares, user0, user0);

        await expect(rebaseTokenOwner.connect(user0).pauseMint()).to.be.rejectedWith(
            'ENotAuthorizedForPause(',
        );
        await expect(rebaseTokenOwner.connect(user0).pauseBurn()).to.be.rejectedWith(
            'ENotAuthorizedForPause(',
        );
        await expect(rebaseTokenOwner.connect(user0).unpauseMint()).to.be.rejectedWith(
            'OwnableUnauthorizedAccount(',
        );
        await expect(rebaseTokenOwner.connect(user0).unpauseBurn()).to.be.rejectedWith(
            'OwnableUnauthorizedAccount(',
        );
    });

    it('Test rebaseTokenOwner errors', async () => {
        const {
            supplyManager,
            usdcVault,
            randAccount,
            USDC,
            rebaseToken,
            rebaseTokenOwner,
            guardian,
        } = await loadFixture(deployNitrogenWithTokenVault);

        await expect(rebaseTokenOwner.addTokenVault(usdcVault)).to.be.rejectedWith(
            'EHasTokenVaultForAsset(',
        );

        // Create new dai tokenVault
        const TokenVault = await ethers.getContractFactory('NitrogenTokenVault');
        const daiTokenVault = await TokenVault.connect(randAccount).deploy(
            randAccount,
            rebaseToken, // share
            supplyManager,
            rebaseTokenOwner,
            guardian,
            ethers.ZeroAddress,
        );

        await expect(
            rebaseTokenOwner.connect(randAccount).addTokenVault(daiTokenVault),
        ).to.be.rejectedWith('OwnableUnauthorizedAccount(');
        await expect(rebaseTokenOwner.addTokenVault(daiTokenVault)).to.be.rejectedWith(
            'ETokenVaultNotInit(',
        );

        await expect(
            rebaseTokenOwner.connect(randAccount).callRebaseToken('0x'),
        ).to.be.rejectedWith('OwnableUnauthorizedAccount(');

        await expect(usdcVault.connect(randAccount).setMinDepositAssets(0)).to.be.rejectedWith(
            'OwnableUnauthorizedAccount(',
        );
        await expect(usdcVault.connect(randAccount).setMinRedeemShares(0)).to.be.rejectedWith(
            'OwnableUnauthorizedAccount(',
        );
        await expect(
            rebaseTokenOwner.connect(randAccount).removeTokenVault(usdcVault),
        ).to.be.rejectedWith('OwnableUnauthorizedAccount(');
        await expect(rebaseTokenOwner.connect(randAccount).mint(randAccount, 1)).to.be.rejectedWith(
            'TokenVaultNotAllowed(',
        );
        await expect(rebaseTokenOwner.connect(randAccount).burn(randAccount, 1)).to.be.rejectedWith(
            'TokenVaultNotAllowed(',
        );
        await expect(rebaseTokenOwner.connect(randAccount).distribute([], [])).to.be.rejectedWith(
            'TokenVaultNotAllowed(',
        );

        await expect(
            rebaseTokenOwner.callRebaseToken(
                rebaseToken.interface.encodeFunctionData('renounceOwnership'),
            ),
        ).to.be.rejectedWith('EBadSelector(');
        await expect(
            rebaseTokenOwner.callRebaseToken(
                rebaseToken.interface.encodeFunctionData('mint', [ethers.ZeroAddress, 0]),
            ),
        ).to.be.rejectedWith('EBadSelector(');
        await expect(
            rebaseTokenOwner.callRebaseToken(
                rebaseToken.interface.encodeFunctionData('burn', [ethers.ZeroAddress, 0]),
            ),
        ).to.be.rejectedWith('EBadSelector(');

        await expect(usdcVault.connect(randAccount).changeGuardian(USDC)).to.be.rejectedWith(
            'OwnableUnauthorizedAccount(',
        );
        await expect(usdcVault.changeGuardian(ethers.ZeroAddress)).to.be.rejectedWith(
            'EZeroAddress(',
        );

        await expect(usdcVault.connect(randAccount).pauseRequestDeposit()).to.be.rejectedWith(
            'ENotAuthorizedForPause(',
        );
        await expect(usdcVault.connect(randAccount).unpauseRequestDeposit()).to.be.rejectedWith(
            'OwnableUnauthorizedAccount(',
        );

        await expect(usdcVault.connect(randAccount).pauseRequestRedeem()).to.be.rejectedWith(
            'ENotAuthorizedForPause(',
        );
        await expect(usdcVault.connect(randAccount).unpauseRequestRedeem()).to.be.rejectedWith(
            'OwnableUnauthorizedAccount(',
        );

        await expect(usdcVault.connect(randAccount).pauseAll()).to.be.rejectedWith(
            'ENotAuthorizedForPause(',
        );
        await expect(usdcVault.connect(randAccount).unpauseAll()).to.be.rejectedWith(
            'OwnableUnauthorizedAccount(',
        );

        await expect(
            rebaseTokenOwner.connect(randAccount).setCodeHash(ethers.ZeroHash, false),
        ).to.be.rejectedWith('OwnableUnauthorizedAccount(');
    });

    it('Test usdcVault errors', async () => {
        const { usdcVault, randAccount, USDC, poolOwner } = await loadFixture(
            deployNitrogenWithTokenVault,
        );

        await expect(
            usdcVault.connect(poolOwner).init(ethers.ZeroAddress, 0, 0),
        ).to.be.rejectedWith('EZeroAddress()');
        await expect(usdcVault.connect(randAccount).init(USDC, 1, 1)).to.be.rejectedWith(
            'OwnableUnauthorizedAccount(',
        );
        await expect(usdcVault.init(USDC, 1, 1)).to.be.rejectedWith('EAlreadyInitialized()');

        await expect(
            usdcVault
                .connect(randAccount)
                ['deposit(uint256,address,address)'](0, ethers.ZeroAddress, ethers.ZeroAddress),
        ).to.be.rejectedWith('EInvalidOperator(');

        await expect(
            usdcVault.connect(randAccount).requestRedeem(0, ethers.ZeroAddress, ethers.ZeroAddress),
        ).to.be.rejectedWith('EInvalidOperator(');
        await expect(
            usdcVault
                .connect(randAccount)
                .requestWithdraw(0, ethers.ZeroAddress, ethers.ZeroAddress),
        ).to.be.rejectedWith('EInvalidOperator(');

        await expect(
            usdcVault
                .connect(randAccount)
                ['redeem(address,uint256[],uint256[],uint256)'](ethers.ZeroAddress, [], [], 0),
        ).to.be.rejectedWith('ENotAuthorized()');

        await expect(
            usdcVault.connect(randAccount).distribute([], [], { value: 1n }),
        ).to.be.rejectedWith('EMsgValueIsNotZero()');
        await expect(
            usdcVault
                .connect(randAccount)
                [
                    'redeem(address,uint256[],uint256[],uint256)'
                ](ethers.ZeroAddress, [], [], 0, { value: 1n }),
        ).to.be.rejectedWith('EMsgValueIsNotZero()');
        await expect(usdcVault.connect(randAccount).distribute([], [])).to.be.rejectedWith(
            'ENotAuthorized()',
        );
    });

    it('Test usdcVault transfer ownership ', async () => {
        const { usdcVault, rebaseTokenOwner, user1, poolOwner } = await loadFixture(
            deployNitrogenWithTokenVault,
        );

        for (const ownableContract of [usdcVault, rebaseTokenOwner]) {
            await ownableContract.transferOwnership(user1);
            expect(await ownableContract.owner()).to.be.equal(poolOwner);
            await ownableContract.connect(user1).acceptOwnership();
            expect(await ownableContract.owner()).to.be.equal(user1);
        }
    });

    it('Should support interface', async () => {
        const { usdcVault, rebaseTokenOwner } = await loadFixture(deployNitrogenWithTokenVault);

        // https://eips.ethereum.org/EIPS/eip-7540
        expect(await usdcVault.supportsInterface('0xe3bc4e65')).to.be.equal(true);
        expect(await usdcVault.supportsInterface('0xce3bbe50')).to.be.equal(true);
        expect(await usdcVault.supportsInterface('0x620ee8e4')).to.be.equal(true);

        // https://eips.ethereum.org/EIPS/eip-7575
        expect(await usdcVault.supportsInterface('0x2f0a18c5')).to.be.equal(true);
        expect(await rebaseTokenOwner.supportsInterface('0xf815c03d')).to.be.equal(true);
        expect(await usdcVault.supportsInterface('0x01ffc9a7')).to.be.equal(true);
        expect(await rebaseTokenOwner.supportsInterface('0x01ffc9a7')).to.be.equal(true);

        // Just bad ids
        expect(await usdcVault.supportsInterface('0x11223344')).to.be.equal(false);
        expect(await rebaseTokenOwner.supportsInterface('0x11223344')).to.be.equal(false);
    });

    it('Test conversions', async () => {
        const {
            poolOwner,
            poolKeeper,
            randAccount,
            supplyManager,
            rebaseToken,
            usdcVault,
            susdeVault,
            moleculaPool,
            USDC,
            sUSDe,
            user0,
        } = await loadFixture(deployNitrogenWithTokenVault);

        // Generate yield
        await grantERC20(moleculaPool, USDC, 10n ** 6n - 1n);
        await grantERC20(moleculaPool, sUSDe, 10n ** 18n - 1n, FAUCET.sUSDe);

        const { pool: totalPool, shares: totalShares } = await supplyManager.getTotalSupply();
        const shares = 10n ** 18n;

        // Test totalAssets
        expect(await usdcVault.totalAssets()).to.be.equal(await USDC.balanceOf(moleculaPool));
        expect(await susdeVault.totalAssets()).to.be.equal(await sUSDe.balanceOf(moleculaPool));

        // Test usdcVault
        const usdcAmount = await usdcVault.convertToAssets(shares);
        expect(usdcAmount).to.be.equal((shares * totalPool) / totalShares / 10n ** 12n);
        expect(await usdcVault.convertToShares(usdcAmount)).to.be.equal(
            (usdcAmount * 10n ** 12n * totalShares) / totalPool,
        );

        // Test tokenUSDEVault
        const susdeAmount = await susdeVault.convertToAssets(shares);
        expect(susdeAmount).to.be.equal(
            await sUSDe.connect(user0).convertToShares((shares * totalPool) / totalShares),
        );
        expect(await susdeVault.convertToShares(susdeAmount)).to.be.equal(
            ((await sUSDe.connect(user0).convertToAssets(susdeAmount)) * totalShares) / totalPool,
        );

        // User0 deposits sUSDe. Then we check user0's shares with the expected amount
        await grantERC20(user0, sUSDe, susdeAmount, FAUCET.sUSDe);
        expect(await rebaseToken.sharesOf(user0)).to.be.equal(0);
        await sUSDe.connect(user0).approve(susdeVault, susdeAmount);
        await susdeVault.connect(user0).requestDeposit(susdeAmount, user0, user0);
        const userShares = await rebaseToken.sharesOf(user0);
        expect(userShares).to.be.equal(await susdeVault.convertToShares(susdeAmount));

        // user0 redeems their shares
        const userSUSDE = await susdeVault.connect(user0).convertToAssets(userShares);
        await susdeVault.connect(user0).redeemImmediately(userShares, user0, user0);
        expectEqual(await sUSDe.connect(user0).balanceOf(user0), userSUSDE, 18, 6);

        // Get rid of USDC, USDE from moleculaPool, remove tokens and test errors
        await getRidOf(moleculaPool, poolOwner, USDC, randAccount.address, poolKeeper);
        await getRidOf(moleculaPool, poolOwner, sUSDe, randAccount.address, poolKeeper);
        await moleculaPool.removeToken(USDC);
        await moleculaPool.removeToken(sUSDe);
        await expect(usdcVault.convertToAssets(shares)).to.be.rejectedWith('ETokenNotExist()');
        await expect(susdeVault.convertToShares(shares)).to.be.rejectedWith('ETokenNotExist()');
    });

    it('Test erc4626', async () => {
        const { sparkUsdcVault, sparkUSDC, user0, rebaseToken } = await loadFixture(
            deployNitrogenWithTokenVault,
        );

        const depositValue = 100n * 10n ** 18n - 1n;

        // Check conversion between the Molecula asset and sparkUSDC
        const moleculaAssets = await sparkUsdcVault.convertAssetsToMoleculaAssets(depositValue);
        expect(moleculaAssets).to.be.greaterThan(depositValue);
        expect(moleculaAssets).to.be.lessThan(2n * depositValue);

        // Grand sparkUSDC and approve tokens for sparkUSDC
        await grantERC20(user0, sparkUSDC, depositValue, FAUCET.sparkUSDC);
        await sparkUSDC.connect(user0).approve(sparkUsdcVault, depositValue);

        // Deposit sparkUSDC
        await sparkUsdcVault
            .connect(user0)
            ['deposit(uint256,address,address)'](depositValue, user0, user0);
        const rebaseTokenBalance = await rebaseToken.balanceOf(user0);
        expectEqual(moleculaAssets, rebaseTokenBalance, 18, 5);
    });
});
