/* eslint-disable no-restricted-syntax, @typescript-eslint/no-explicit-any */

import { type HardhatRuntimeEnvironment } from 'hardhat/types';

import {
    chainLinkFeeds,
    EnvironmentType,
    EVMChainIDs,
} from '@molecula-monorepo/blockchain.addresses';

import {
    metaEthMainnetBetaConfig,
    metaEthMainnetProdConfig,
    type MetaEthNetworkConfig,
    metaEthSepoliaConfig,
    NATIVE_TOKEN,
} from '../../configs';

export function getMetaEthEnvironmentConfig(network: EnvironmentType) {
    switch (network) {
        case EnvironmentType['mainnet/beta']:
            return metaEthMainnetBetaConfig;
        case EnvironmentType['mainnet/prod']:
            return metaEthMainnetProdConfig;
        case EnvironmentType.devnet:
            return metaEthSepoliaConfig;
        default:
            throw new Error('Unsupported network type!');
    }
}

export function getChainId(network: EnvironmentType) {
    switch (network) {
        case EnvironmentType['mainnet/beta']:
            return EVMChainIDs.Mainnet;
        case EnvironmentType['mainnet/prod']:
            return EVMChainIDs.Mainnet;
        case EnvironmentType.devnet:
            return EVMChainIDs.Sepolia;
        default:
            throw new Error('Unsupported network type!');
    }
}

export async function getMetaEthConfig(hre: HardhatRuntimeEnvironment, network: EnvironmentType) {
    const config = getMetaEthEnvironmentConfig(network);
    const account = (await hre.ethers.getSigners())[0]!;
    const chainId = getChainId(network);
    return { config, account, chainId };
}

export function getFeeds(
    hre: HardhatRuntimeEnvironment,
    config: MetaEthNetworkConfig,
    chainId: EVMChainIDs,
    withPoolTokens: boolean,
) {
    const stETHFeed = chainLinkFeeds.eth.stETH[chainId];
    const stEthPriceDeviationBps = stETHFeed.address === hre.ethers.ZeroAddress ? 0 : 50; // 0.5%
    const feeds = [
        {
            asset: config.stETH,
            priceFeed: stETHFeed.address,
            priceDeviationBps: stEthPriceDeviationBps,
            stalenessThreshold: stETHFeed.heartbeat,
        },
        {
            asset: config.wETH,
            priceFeed: hre.ethers.ZeroAddress,
            priceDeviationBps: 0,
            stalenessThreshold: 0,
        },
        {
            asset: NATIVE_TOKEN,
            priceFeed: hre.ethers.ZeroAddress,
            priceDeviationBps: 0,
            stalenessThreshold: 0,
        },
    ];
    if (withPoolTokens) {
        const weETHFeed = chainLinkFeeds.eth.weETH[chainId];
        const rsETHFeed = chainLinkFeeds.eth.rsETH[chainId];
        const ezETHFeed = chainLinkFeeds.eth.ezETH[chainId];
        feeds.push(
            {
                asset: config.weETH,
                priceFeed: weETHFeed.address,
                priceDeviationBps: 50, // 0.5 %
                stalenessThreshold: weETHFeed.heartbeat,
            },
            {
                asset: config.rsETH,
                priceFeed: rsETHFeed.address,
                priceDeviationBps: 50, // 0.5 %
                stalenessThreshold: rsETHFeed.heartbeat,
            },
            {
                asset: config.ezETH,
                priceFeed: ezETHFeed.address,
                priceDeviationBps: 50, // 0.5 %
                stalenessThreshold: ezETHFeed.heartbeat,
            },
        );
    }
    return feeds;
}
