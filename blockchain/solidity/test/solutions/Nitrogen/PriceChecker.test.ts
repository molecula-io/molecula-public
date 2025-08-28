/* eslint-disable camelcase, max-lines, no-await-in-loop, no-restricted-syntax, no-bitwise, no-plusplus */
import { days } from '@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time/duration';
import { loadFixture, time } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';

import { chainLinkFeeds, EVMChainIDs } from '@molecula-monorepo/blockchain.addresses';

import { deployNitrogenWithTokenVault } from '../../utils/NitrogenCommon';
import { FAUCET, grantERC20 } from '../../utils/grant';

describe('Test Price Checker for TokenVault', () => {
    it('Check price for ERC-20 (not extension)', async () => {
        const { usdcVault, USDC, user0, priceChecker } = await loadFixture(
            deployNitrogenWithTokenVault,
        );

        const decimals: bigint = await USDC.decimals();
        const depositValue = 100n * 10n ** decimals;

        // Grand USD and approve tokens for vault
        await grantERC20(user0, USDC, 2n * depositValue);
        await USDC.connect(user0).approve(usdcVault, 2n * depositValue);

        await priceChecker.changePriceDeviationBps(USDC, 0);

        await expect(
            usdcVault
                .connect(user0)
                ['deposit(uint256,address,address)'](depositValue, user0, user0),
        ).to.be.rejectedWith('EAssetPriceNotCloseToExpected(');

        await priceChecker.changePriceDeviationBps(USDC, (5 * 10_000) / 100); // 5%
        await usdcVault
            .connect(user0)
            ['deposit(uint256,address,address)'](depositValue, user0, user0);

        await priceChecker.setPriceFeed(USDC, ethers.ZeroAddress, 0, 0);
        await usdcVault
            .connect(user0)
            ['deposit(uint256,address,address)'](depositValue, user0, user0);
    });

    it('Check price errors', async () => {
        const { usdcVault, USDC, user0, poolOwner, priceChecker } = await loadFixture(
            deployNitrogenWithTokenVault,
        );

        const decimals: bigint = await USDC.decimals();
        const depositValue = 100n * 10n ** decimals;

        // Grand USD and approve tokens for vault
        await grantERC20(user0, USDC, 2n * depositValue);
        await USDC.connect(user0).approve(usdcVault, 2n * depositValue);

        // USDC / USD
        const usdcFeed = await (
            await ethers.getContractFactory('MockPriceFeed')
        ).deploy(10n ** 8n, poolOwner);
        await priceChecker.setPriceFeed(USDC, usdcFeed, (5 * 10_000) / 100, days(1));

        await usdcFeed.setPrice(-1);
        await expect(
            usdcVault
                .connect(user0)
                ['deposit(uint256,address,address)'](depositValue, user0, user0),
        ).to.be.rejectedWith('EPriceNotSet(');
        await usdcFeed.setPrice(10n ** 8n + 1n);

        // Jump to the future
        await time.increase(days(7));
        await expect(
            usdcVault
                .connect(user0)
                ['deposit(uint256,address,address)'](depositValue, user0, user0),
        ).to.be.rejectedWith('EChainlinkPriceFeedStale(');

        await usdcFeed.setPrice(10n ** 8n + 1n);
        await usdcVault
            .connect(user0)
            ['deposit(uint256,address,address)'](depositValue, user0, user0);
    });

    it('Check price for sUSDe using sUSDe', async () => {
        const { susdeVault, sUSDe, user0, priceChecker } = await loadFixture(
            deployNitrogenWithTokenVault,
        );

        const decimals: bigint = await sUSDe.decimals();
        const depositValue = 100n * 10n ** decimals;

        // Grand USD and approve tokens for vault
        await grantERC20(user0, sUSDe, depositValue, FAUCET.sUSDe);
        await sUSDe.connect(user0).approve(susdeVault, depositValue);

        // sUSDe / USD
        await priceChecker.changePriceDeviationBps(sUSDe, 0);

        await expect(
            susdeVault
                .connect(user0)
                ['deposit(uint256,address,address)'](depositValue, user0, user0),
        ).to.be.rejectedWith('EAssetPriceNotCloseToExpected(');

        await priceChecker.changePriceDeviationBps(sUSDe, (5 * 10_000) / 100); // 5%
        await susdeVault
            .connect(user0)
            ['deposit(uint256,address,address)'](depositValue, user0, user0);
    });

    it('Check setters', async () => {
        const { user0, poolOwner, usdcVault, USDC, sUSDe } = await loadFixture(
            deployNitrogenWithTokenVault,
        );
        const feed = chainLinkFeeds.usd.USDe[EVMChainIDs.Mainnet];
        const PriceChecker = await ethers.getContractFactory('PriceChecker');
        const priceChecker = await PriceChecker.connect(poolOwner).deploy(
            [
                {
                    asset: USDC,
                    priceFeed: feed.address,
                    priceDeviationBps: 0,
                    stalenessThreshold: feed.heartbeat,
                },
            ],
            poolOwner,
            18,
        );
        const priceChecker4626 = await PriceChecker.connect(poolOwner).deploy(
            [
                {
                    asset: sUSDe,
                    priceFeed: feed.address,
                    priceDeviationBps: 0,
                    stalenessThreshold: feed.heartbeat,
                },
            ],
            poolOwner,
            18,
        );

        await expect(usdcVault.connect(user0).setPriceChecker(priceChecker4626)).to.be.rejectedWith(
            'OwnableUnauthorizedAccount(',
        );
        await expect(usdcVault.setPriceChecker(priceChecker4626)).to.be.rejectedWith(
            'NoPriceChecker(',
        );

        await priceChecker.changePriceDeviationBps(USDC, 1);
        await expect(priceChecker.changePriceDeviationBps(USDC, 1)).to.be.rejectedWith(
            'ESameValue()',
        );
        await expect(priceChecker.changePriceDeviationBps(USDC, 10_001)).to.be.rejectedWith(
            'EInvalidPercentage()',
        );

        await expect(
            priceChecker.setPriceFeed(USDC, ethers.ZeroAddress, 500, days(1)),
        ).to.be.rejectedWith('EBadFeedConfig()');
        await expect(priceChecker.setPriceFeed(USDC, ethers.ZeroAddress, 0, 1)).to.be.rejectedWith(
            'EBadFeedConfig(',
        );
        await expect(
            priceChecker.setPriceFeed(ethers.ZeroAddress, feed.address, 500, feed.heartbeat),
        ).to.be.rejectedWith('EZeroAddress(');

        await expect(
            priceChecker.setPriceFeed(USDC, feed.address, 1, feed.heartbeat),
        ).to.be.rejectedWith('ESameValue()');

        await priceChecker.removePriceFeed(USDC);
        await expect(priceChecker.removePriceFeed(USDC)).to.be.rejectedWith('NoPriceChecker(');

        await priceChecker.setPriceFeed(USDC, feed.address, 1, feed.heartbeat);
        await expect(
            priceChecker.setPriceFeed(USDC, feed.address, 1, feed.heartbeat),
        ).to.be.rejectedWith('ESameValue()');

        await expect(
            priceChecker.connect(user0).setPriceFeed(USDC, user0, 1, days(1)),
        ).to.be.rejectedWith('OwnableUnauthorizedAccount(');
        await expect(
            priceChecker.connect(user0).changePriceDeviationBps(USDC, 1),
        ).to.be.rejectedWith('OwnableUnauthorizedAccount(');
        await expect(
            priceChecker.connect(user0).setPriceFeed(USDC, user0, 1, days(1)),
        ).to.be.rejectedWith('OwnableUnauthorizedAccount(');
        await expect(priceChecker.connect(user0).removePriceFeed(USDC)).to.be.rejectedWith(
            'OwnableUnauthorizedAccount(',
        );
        await expect(
            priceChecker.changePriceDeviationBps(USDC, (1n << 16n) - 1n),
        ).to.be.rejectedWith('EInvalidPercentage(');

        await expect(priceChecker.changeStalenessThreshold(USDC, 0)).to.be.rejectedWith(
            'EBadStalenessThreshold(',
        );
        await expect(priceChecker.changeStalenessThreshold(USDC, days(7) + 1)).to.be.rejectedWith(
            'EBadStalenessThreshold(',
        );
        await expect(
            priceChecker.changeStalenessThreshold(USDC, feed.heartbeat),
        ).to.be.rejectedWith('ESameValue(');
        await expect(
            priceChecker.connect(user0).changeStalenessThreshold(USDC, days(1)),
        ).to.be.rejectedWith('OwnableUnauthorizedAccount(');

        await priceChecker.changeStalenessThreshold(USDC, days(2));
        expect((await priceChecker.checkers(USDC)).stalenessThreshold).to.be.equal(days(2));
    });

    it('Check priceChecker errors', async () => {
        const { poolOwner, USDC } = await loadFixture(deployNitrogenWithTokenVault);
        const feed = chainLinkFeeds.usd.USDe[EVMChainIDs.Mainnet];

        const PriceChecker = await ethers.getContractFactory('PriceChecker');
        await expect(
            PriceChecker.connect(poolOwner).deploy(
                [
                    {
                        asset: USDC,
                        priceFeed: feed.address,
                        priceDeviationBps: 0,
                        stalenessThreshold: feed.heartbeat,
                    },
                    {
                        asset: USDC,
                        priceFeed: feed.address,
                        priceDeviationBps: 0,
                        stalenessThreshold: feed.heartbeat,
                    },
                ],
                poolOwner,
                18,
            ),
        ).to.be.rejectedWith('ECheckerAlreadyPresent(');

        await expect(
            PriceChecker.connect(poolOwner).deploy(
                [
                    {
                        asset: USDC,
                        priceFeed: feed.address,
                        priceDeviationBps: 2n ** 16n - 1n,
                        stalenessThreshold: feed.heartbeat,
                    },
                ],
                poolOwner,
                18,
            ),
        ).to.be.rejectedWith('EInvalidPercentage(');

        await expect(
            PriceChecker.connect(poolOwner).deploy(
                [
                    {
                        asset: USDC,
                        priceFeed: feed.address,
                        priceDeviationBps: 0,
                        stalenessThreshold: 1,
                    },
                ],
                poolOwner,
                18,
            ),
        ).to.be.rejectedWith('EBadStalenessThreshold(');
    });
});
