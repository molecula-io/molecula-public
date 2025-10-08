/* eslint-disable no-restricted-syntax */

import { type HardhatRuntimeEnvironment } from 'hardhat/types';

import {
    chainLinkFeeds,
    type ContractsNitrogen,
    EnvironmentType,
    EVMChainIDs,
    staticPoolCurrenciesRetailTestnet,
} from '@molecula-monorepo/blockchain.addresses';

import { DEPLOY_GAS_LIMIT } from '../../../../configs';
import { DEFAULT_PRICE_DEVIATION_BPS, getEnvironmentConfig, zeroPriceFeed } from '../../../utils';
import { verifyContractWithRetry } from '../../../verificationUtils';

export function getSepoliaCheckers(mUSDe: string, sUSDe: string) {
    const usdcFeed = chainLinkFeeds.usd.usdc[EVMChainIDs.Sepolia];
    const usdeFeed = chainLinkFeeds.usd.USDe[EVMChainIDs.Sepolia];
    const checkers = [
        zeroPriceFeed(staticPoolCurrenciesRetailTestnet.USDT.token),
        {
            asset: staticPoolCurrenciesRetailTestnet.USDC.token,
            priceFeed: usdcFeed.address,
            priceDeviationBps: DEFAULT_PRICE_DEVIATION_BPS,
            stalenessThreshold: usdcFeed.heartbeat,
        },
        zeroPriceFeed(staticPoolCurrenciesRetailTestnet.DAI.token),
        {
            asset: staticPoolCurrenciesRetailTestnet.USDe.token,
            priceFeed: usdeFeed.address,
            priceDeviationBps: DEFAULT_PRICE_DEVIATION_BPS,
            stalenessThreshold: usdeFeed.heartbeat,
        },
        zeroPriceFeed(staticPoolCurrenciesRetailTestnet.aEthUSDT.token),
        zeroPriceFeed(staticPoolCurrenciesRetailTestnet.aEthUSDC.token),
        zeroPriceFeed(staticPoolCurrenciesRetailTestnet.aEthDAI.token),
    ];
    if (mUSDe !== '') {
        checkers.push(zeroPriceFeed(mUSDe));
    }
    checkers.push(zeroPriceFeed(sUSDe));
    return checkers;
}

export async function deployPriceChecker(
    hre: HardhatRuntimeEnvironment,
    environment: EnvironmentType,
    contractsNitrogen: ContractsNitrogen,
) {
    const config = getEnvironmentConfig(environment);

    const PriceChecker = await hre.ethers.getContractFactory('PriceChecker');

    let checkers: {
        asset: string;
        priceFeed: string;
        priceDeviationBps: number;
        stalenessThreshold: number;
    }[] = [];
    if (environment === EnvironmentType.devnet) {
        checkers = getSepoliaCheckers(
            contractsNitrogen.eth.mUSDe,
            contractsNitrogen.eth.ethena.sUSDe,
        );
    } else {
        throw Error('Unsupported yet');
    }

    const moleculaPoolTreasuryV2 = await hre.ethers.getContractAt(
        'MoleculaPoolTreasuryV2',
        contractsNitrogen.eth.moleculaPool,
    );

    function printTokensAndCheckers() {
        let text = `\ntokenParams:\n`;
        tokenParams.forEach((tokenParam, index) => {
            text += `${index}: ${tokenParam.token}\n`;
        });

        text += `\ncheckers:\n`;
        checkers.forEach((checker, index) => {
            text += `${index}: ${checker.asset}\n`;
        });
        return text;
    }

    const tokenParams = await moleculaPoolTreasuryV2.getTokenPool();
    if (tokenParams.length !== checkers.length) {
        throw Error(`Unexpected token length: ${printTokensAndCheckers()}`);
    }

    const checkerTokens = new Set<string>(checkers.map(checker => checker.asset.toLowerCase()));
    tokenParams.forEach(({ token }) => {
        if (!checkerTokens.has(token.toLowerCase())) {
            throw Error(`There is no price checker for ${token}\n${printTokensAndCheckers()}`);
        }
    });

    console.log(`Deploying PriceChecker...`);
    const priceChecker = await PriceChecker.deploy(
        checkers,
        config.OWNER,
        config.MUSD_TOKEN_DECIMALS,
        {
            gasLimit: DEPLOY_GAS_LIMIT,
        },
    );
    await priceChecker.waitForDeployment();
    const priceCheckerAddress = await priceChecker.getAddress();
    console.log('PriceChecker address: ', priceCheckerAddress);

    await verifyContractWithRetry(hre, 'PriceChecker', priceCheckerAddress, [
        checkers,
        config.OWNER,
        config.MUSD_TOKEN_DECIMALS,
    ]);

    return priceCheckerAddress;
}
